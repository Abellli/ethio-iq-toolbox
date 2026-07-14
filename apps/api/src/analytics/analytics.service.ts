import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { AnalyticsFilterDto } from './dto/analytics-query.dto';
import { CrossTabQueryDto } from './dto/crosstab-query.dto';

/**
 * Builds the shared WHERE clause for "responses belonging to this survey,
 * narrowed by the global filter row (region, gender, age range, date range)"
 * — spec 4.3: "global filters that cascade to every chart below."
 * Returns the clause fragment (starting with AND) and the params to append,
 * given the index the next placeholder should start at.
 */
function buildFilter(filter: AnalyticsFilterDto, startIndex: number) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  if (filter.region) {
    clauses.push(`rp.region = $${i++}`);
    params.push(filter.region);
  }
  if (filter.gender) {
    clauses.push(`rp.gender = $${i++}`);
    params.push(filter.gender);
  }
  if (filter.ageMin !== undefined) {
    clauses.push(`(date_part('year', now()) - rp.birth_year) >= $${i++}`);
    params.push(filter.ageMin);
  }
  if (filter.ageMax !== undefined) {
    clauses.push(`(date_part('year', now()) - rp.birth_year) <= $${i++}`);
    params.push(filter.ageMax);
  }
  if (filter.dateFrom) {
    clauses.push(`r.submitted_at >= $${i++}`);
    params.push(filter.dateFrom);
  }
  if (filter.dateTo) {
    clauses.push(`r.submitted_at <= $${i++}`);
    params.push(filter.dateTo);
  }

  return { clause: clauses.length ? `AND ${clauses.join(' AND ')}` : '', params, nextIndex: i };
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async assertOwned(clientId: string, surveyId: string) {
    const result = await this.pool.query(
      `SELECT id FROM surveys WHERE id = $1 AND client_id = $2`,
      [surveyId, clientId],
    );
    if (!result.rowCount) throw new NotFoundException('Survey not found');
  }

  /** KPI strip: total responses, completion rate, fraud-flagged %, avg sentiment (spec 4.3). */
  async getKpis(clientId: string, surveyId: string, filter: AnalyticsFilterDto) {
    await this.assertOwned(clientId, surveyId);
    const { clause, params } = buildFilter(filter, 2);

    const result = await this.pool.query(
      `SELECT
         count(*) AS total_responses,
         count(*) FILTER (WHERE r.status != 'rejected') AS non_rejected,
         count(*) FILTER (WHERE r.status = 'flagged') AS flagged,
         (SELECT avg(a.sentiment_score) FROM answers a
            JOIN responses r2 ON r2.id = a.response_id
            JOIN respondents rp2 ON rp2.id = r2.respondent_id
            WHERE r2.survey_id = $1 AND a.sentiment_score IS NOT NULL
         ) AS avg_sentiment
       FROM responses r
       JOIN respondents rp ON rp.id = r.respondent_id
       WHERE r.survey_id = $1
       ${clause}`,
      [surveyId, ...params],
    );

    const row = result.rows[0];
    const total = Number(row.total_responses);
    return {
      totalResponses: total,
      completionRate: total ? Math.round((Number(row.non_rejected) / total) * 1000) / 10 : 0,
      fraudFlaggedPct: total ? Math.round((Number(row.flagged) / total) * 1000) / 10 : 0,
      avgSentiment: row.avg_sentiment !== null ? Math.round(Number(row.avg_sentiment) * 100) / 100 : null,
    };
  }

  /** Sentiment breakdown bar (spec 4.3, primary visualization row). */
  async getSentimentBreakdown(clientId: string, surveyId: string, filter: AnalyticsFilterDto) {
    await this.assertOwned(clientId, surveyId);
    const { clause, params } = buildFilter(filter, 2);

    const result = await this.pool.query(
      `SELECT a.sentiment_label, count(*) AS count
       FROM answers a
       JOIN responses r ON r.id = a.response_id
       JOIN respondents rp ON rp.id = r.respondent_id
       WHERE r.survey_id = $1 AND a.sentiment_label IS NOT NULL
       ${clause}
       GROUP BY a.sentiment_label`,
      [surveyId, ...params],
    );

    const counts = { positive: 0, neutral: 0, negative: 0 } as Record<string, number>;
    for (const row of result.rows) counts[row.sentiment_label] = Number(row.count);
    return counts;
  }

  /**
   * Trend line over time (spec 4.3, secondary row).
   *
   * Performance tuning (Weeks 11-13): the common case — no demographic
   * filters, just the default view a client lands on — reads from
   * mv_survey_daily_stats instead of joining responses+respondents live.
   * The moment a region/gender/age filter is applied, those dimensions
   * aren't in the materialized view, so we fall back to the live query.
   * Date-range filtering alone still hits the view (it has a `day` column).
   */
  async getTrend(clientId: string, surveyId: string, filter: AnalyticsFilterDto) {
    await this.assertOwned(clientId, surveyId);

    const hasDemographicFilter =
      filter.region !== undefined ||
      filter.gender !== undefined ||
      filter.ageMin !== undefined ||
      filter.ageMax !== undefined;

    if (!hasDemographicFilter) {
      const clauses: string[] = [];
      const params: unknown[] = [surveyId];
      let i = 2;
      if (filter.dateFrom) {
        clauses.push(`day >= $${i++}`);
        params.push(filter.dateFrom);
      }
      if (filter.dateTo) {
        clauses.push(`day <= $${i++}`);
        params.push(filter.dateTo);
      }
      const result = await this.pool.query(
        `SELECT day, total_responses AS count
         FROM mv_survey_daily_stats
         WHERE survey_id = $1 ${clauses.length ? 'AND ' + clauses.join(' AND ') : ''}
         ORDER BY day`,
        params,
      );
      return result.rows.map((row) => ({ date: row.day, count: Number(row.count) }));
    }

    const { clause, params } = buildFilter(filter, 2);
    const result = await this.pool.query(
      `SELECT date_trunc('day', r.submitted_at) AS day, count(*) AS count
       FROM responses r
       JOIN respondents rp ON rp.id = r.respondent_id
       WHERE r.survey_id = $1
       ${clause}
       GROUP BY 1 ORDER BY 1`,
      [surveyId, ...params],
    );
    return result.rows.map((row) => ({ date: row.day, count: Number(row.count) }));
  }

  /**
   * Cross-tabulation pivot (spec 4.3: "brand preference × age group ... ability
   * to swap either axis"). Restricted to single_choice/scale/nps/multi_choice
   * questions on the same survey — open_text doesn't pivot meaningfully.
   */
  async getCrossTab(clientId: string, surveyId: string, dto: CrossTabQueryDto) {
    await this.assertOwned(clientId, surveyId);
    const { clause, params, nextIndex } = buildFilter(dto, 4);

    const result = await this.pool.query(
      `SELECT a1.answer_value AS row_value, a2.answer_value AS column_value, count(*) AS count
       FROM answers a1
       JOIN answers a2 ON a2.response_id = a1.response_id
       JOIN responses r ON r.id = a1.response_id
       JOIN respondents rp ON rp.id = r.respondent_id
       WHERE a1.question_id = $2 AND a2.question_id = $3 AND r.survey_id = $1
       ${clause}
       GROUP BY 1, 2`,
      [surveyId, dto.rowQuestionId, dto.columnQuestionId, ...params],
    );

    const rowValues = new Set<string>();
    const columnValues = new Set<string>();
    const cells: Record<string, Record<string, number>> = {};

    for (const r of result.rows) {
      // answer_value is JSONB; single_choice/scale/nps store a plain string/number, so
      // JSON.stringify(r.row_value) round-trips cleanly as the pivot key.
      const rowKey = String(r.row_value);
      const colKey = String(r.column_value);
      rowValues.add(rowKey);
      columnValues.add(colKey);
      cells[rowKey] = cells[rowKey] ?? {};
      cells[rowKey][colKey] = Number(r.count);
    }

    return {
      rows: Array.from(rowValues),
      columns: Array.from(columnValues),
      cells,
    };
  }

  /** CSV export — one row per (response, question) answer, long format. */
  async exportCsv(clientId: string, surveyId: string, filter: AnalyticsFilterDto): Promise<string> {
    await this.assertOwned(clientId, surveyId);
    const { clause, params } = buildFilter(filter, 2);

    const result = await this.pool.query(
      `SELECT r.id AS response_id, r.submitted_at, r.status, r.fraud_score,
              rp.region, rp.gender, rp.birth_year,
              q.prompt AS question, a.answer_value, a.sentiment_label
       FROM responses r
       JOIN respondents rp ON rp.id = r.respondent_id
       JOIN answers a ON a.response_id = r.id
       JOIN questions q ON q.id = a.question_id
       WHERE r.survey_id = $1
       ${clause}
       ORDER BY r.submitted_at, q.order_index`,
      [surveyId, ...params],
    );

    const header = [
      'response_id',
      'submitted_at',
      'status',
      'fraud_score',
      'region',
      'gender',
      'birth_year',
      'question',
      'answer_value',
      'sentiment_label',
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const row of result.rows) {
      lines.push(
        header
          .map((col) =>
            col === 'answer_value' ? escape(JSON.stringify(row[col])) : escape(row[col]),
          )
          .join(','),
      );
    }
    return lines.join('\n');
  }

  /**
   * Geospatial heatmap data (spec 4.3: "geospatial heatmap ... for regional
   * demographics", PostGIS + deck.gl per section 1.2). Returns raw lat/lng
   * points; deck.gl's HeatmapLayer does the density aggregation client-side.
   * Capped at 5,000 points — plenty for Phase 1 pilot volume, and keeps the
   * payload small; revisit with server-side binning if a survey outgrows it.
   */
  async getHeatmapPoints(clientId: string, surveyId: string, filter: AnalyticsFilterDto) {
    await this.assertOwned(clientId, surveyId);
    const { clause, params } = buildFilter(filter, 2);

    const result = await this.pool.query(
      `SELECT ST_Y(r.gps_point::geometry) AS lat, ST_X(r.gps_point::geometry) AS lng
       FROM responses r
       JOIN respondents rp ON rp.id = r.respondent_id
       WHERE r.survey_id = $1 AND r.gps_point IS NOT NULL
       ${clause}
       LIMIT 5000`,
      [surveyId, ...params],
    );
    return result.rows.map((row) => ({ lat: Number(row.lat), lng: Number(row.lng), weight: 1 }));
  }

  /**
   * Sunburst data (spec 4.3, secondary row: "region → sub-city → response").
   * The schema doesn't have a separate sub-city column — `respondents.region`
   * is the one normalized location field — so region labels that encode a
   * sub-city (e.g. "Addis Ababa - Bole", matching the geofence label example
   * in the schema) are split on " - " into two levels. The innermost ring is
   * sentiment_label, standing in for "response" as the outcome dimension.
   * Returns a d3-hierarchy-friendly nested shape: {name, children: [...]} or
   * {name, value} at the leaves.
   */
  async getSunburstData(clientId: string, surveyId: string, filter: AnalyticsFilterDto) {
    await this.assertOwned(clientId, surveyId);
    const { clause, params } = buildFilter(filter, 2);

    const result = await this.pool.query(
      `SELECT rp.region, a.sentiment_label, count(*) AS count
       FROM responses r
       JOIN respondents rp ON rp.id = r.respondent_id
       LEFT JOIN answers a ON a.response_id = r.id AND a.sentiment_label IS NOT NULL
       WHERE r.survey_id = $1
       ${clause}
       GROUP BY rp.region, a.sentiment_label`,
      [surveyId, ...params],
    );

    type Node = { name: string; children?: Map<string, Node>; value?: number };
    const root: Node = { name: 'root', children: new Map() };

    for (const row of result.rows) {
      const regionRaw: string = row.region ?? 'Unknown';
      const [region, subRegion] = regionRaw.includes(' - ')
        ? regionRaw.split(' - ').map((s: string) => s.trim())
        : [regionRaw, 'All'];
      const sentiment: string = row.sentiment_label ?? 'unscored';
      const count = Number(row.count);

      if (!root.children!.has(region)) root.children!.set(region, { name: region, children: new Map() });
      const regionNode = root.children!.get(region)!;

      if (!regionNode.children!.has(subRegion))
        regionNode.children!.set(subRegion, { name: subRegion, children: new Map() });
      const subNode = regionNode.children!.get(subRegion)!;

      const existing = subNode.children!.get(sentiment);
      subNode.children!.set(sentiment, {
        name: sentiment,
        value: (existing?.value ?? 0) + count,
      });
    }

    // Convert the Map-based tree into plain nested objects/arrays for JSON.
    const toPlain = (node: Node): any =>
      node.children
        ? { name: node.name, children: Array.from(node.children.values()).map(toPlain) }
        : { name: node.name, value: node.value };

    return toPlain(root);
  }
}
