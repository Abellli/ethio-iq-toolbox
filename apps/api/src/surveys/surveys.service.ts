import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { CreateSurveyDto, UpdateSurveyDto } from './dto/survey.dto';
import { SaveQuestionsDto } from './dto/question.dto';
import { UpsertGeofenceDto } from '../geofences/geofence.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [],
};

@Injectable()
export class SurveysService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(clientId: string, dto: CreateSurveyDto) {
    const result = await this.pool.query(
      `INSERT INTO surveys (client_id, title, description, tier)
       VALUES ($1, $2, $3, COALESCE($4, 'free'))
       RETURNING *`,
      [clientId, dto.title, dto.description ?? null, dto.tier ?? null],
    );
    return result.rows[0];
  }

  async list(clientId: string) {
    const result = await this.pool.query(
      `SELECT s.*,
              (SELECT count(*) FROM responses r WHERE r.survey_id = s.id) AS response_count
       FROM surveys s
       WHERE s.client_id = $1
       ORDER BY s.created_at DESC`,
      [clientId],
    );
    return result.rows;
  }

  async getOne(clientId: string, surveyId: string) {
    const survey = await this.pool.query(
      `SELECT * FROM surveys WHERE id = $1 AND client_id = $2`,
      [surveyId, clientId],
    );
    if (!survey.rowCount) throw new NotFoundException('Survey not found');

    const questions = await this.pool.query(
      `SELECT * FROM questions WHERE survey_id = $1 ORDER BY order_index ASC`,
      [surveyId],
    );

    const geofence = await this.pool.query(
      `SELECT id, label, ST_AsGeoJSON(area) AS area_geojson,
              ST_AsGeoJSON(center) AS center_geojson, radius_meters
       FROM geofences WHERE survey_id = $1`,
      [surveyId],
    );

    return {
      ...survey.rows[0],
      questions: questions.rows,
      geofence: geofence.rows[0] ?? null,
    };
  }

  async update(clientId: string, surveyId: string, dto: UpdateSurveyDto) {
    await this.assertOwned(clientId, surveyId);

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const map: Record<string, unknown> = {
      title: dto.title,
      description: dto.description,
      tier: dto.tier,
      incentive_amount_cents: dto.incentiveAmountCents,
      budget_cap_cents: dto.budgetCapCents,
      target_demographics: dto.targetDemographics
        ? JSON.stringify(dto.targetDemographics)
        : undefined,
      max_responses: dto.maxResponses,
      starts_at: dto.startsAt,
      ends_at: dto.endsAt,
    };

    for (const [column, value] of Object.entries(map)) {
      if (value === undefined) continue;
      fields.push(`${column} = $${i}`);
      values.push(column === 'target_demographics' ? value : value);
      i++;
    }

    if (!fields.length) return this.getOne(clientId, surveyId);

    values.push(surveyId, clientId);
    const result = await this.pool.query(
      `UPDATE surveys SET ${fields.join(', ')}
       WHERE id = $${i} AND client_id = $${i + 1}
       RETURNING *`,
      values,
    );
    return result.rows[0];
  }

  /** Center-pane "save" from the drag-and-drop builder — replaces the full ordered question list. */
  async saveQuestions(clientId: string, surveyId: string, dto: SaveQuestionsDto) {
    await this.assertOwned(clientId, surveyId);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const incomingIds = dto.questions.filter((q) => q.id).map((q) => q.id);
      if (incomingIds.length) {
        await client.query(
          `DELETE FROM questions WHERE survey_id = $1 AND id != ALL($2::uuid[])`,
          [surveyId, incomingIds],
        );
      } else {
        await client.query(`DELETE FROM questions WHERE survey_id = $1`, [surveyId]);
      }

      const saved = [];
      for (let index = 0; index < dto.questions.length; index++) {
        const q = dto.questions[index];
        if (q.id) {
          const row = await client.query(
            `UPDATE questions
             SET order_index = $1, type = $2, prompt = $3, config = $4, is_required = COALESCE($5, is_required)
             WHERE id = $6 AND survey_id = $7
             RETURNING *`,
            [index, q.type, q.prompt, q.config ? JSON.stringify(q.config) : null, q.isRequired, q.id, surveyId],
          );
          saved.push(row.rows[0]);
        } else {
          const row = await client.query(
            `INSERT INTO questions (survey_id, order_index, type, prompt, config, is_required)
             VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
             RETURNING *`,
            [surveyId, index, q.type, q.prompt, q.config ? JSON.stringify(q.config) : null, q.isRequired],
          );
          saved.push(row.rows[0]);
        }
      }

      await client.query('COMMIT');
      return saved;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async transitionStatus(clientId: string, surveyId: string, target: string) {
    const survey = await this.assertOwned(clientId, surveyId);
    const allowed = VALID_TRANSITIONS[survey.status] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot move survey from "${survey.status}" to "${target}"`,
      );
    }
    if (target === 'active') {
      const questionCount = await this.pool.query(
        `SELECT count(*) FROM questions WHERE survey_id = $1`,
        [surveyId],
      );
      if (Number(questionCount.rows[0].count) === 0) {
        throw new BadRequestException('Add at least one question before publishing');
      }
    }
    const result = await this.pool.query(
      `UPDATE surveys SET status = $1 WHERE id = $2 AND client_id = $3 RETURNING *`,
      [target, surveyId, clientId],
    );
    return result.rows[0];
  }

  async upsertGeofence(clientId: string, surveyId: string, dto: UpsertGeofenceDto) {
    await this.assertOwned(clientId, surveyId);

    const existing = await this.pool.query(
      `SELECT id FROM geofences WHERE survey_id = $1`,
      [surveyId],
    );

    let row;
    if (dto.polygon?.length) {
      const geojson = JSON.stringify({ type: 'Polygon', coordinates: [dto.polygon] });
      if (existing.rowCount) {
        row = await this.pool.query(
          `UPDATE geofences SET label = $1, area = ST_GeomFromGeoJSON($2), center = NULL, radius_meters = NULL
           WHERE survey_id = $3 RETURNING id, label, radius_meters`,
          [dto.label ?? null, geojson, surveyId],
        );
      } else {
        row = await this.pool.query(
          `INSERT INTO geofences (survey_id, label, area)
           VALUES ($1, $2, ST_GeomFromGeoJSON($3)) RETURNING id, label, radius_meters`,
          [surveyId, dto.label ?? null, geojson],
        );
      }
    } else {
      const point = `SRID=4326;POINT(${dto.centerLng} ${dto.centerLat})`;
      if (existing.rowCount) {
        row = await this.pool.query(
          `UPDATE geofences SET label = $1, center = ST_GeomFromEWKT($2), radius_meters = $3, area = NULL
           WHERE survey_id = $4 RETURNING id, label, radius_meters`,
          [dto.label ?? null, point, dto.radiusMeters, surveyId],
        );
      } else {
        row = await this.pool.query(
          `INSERT INTO geofences (survey_id, label, center, radius_meters)
           VALUES ($1, $2, ST_GeomFromEWKT($3), $4) RETURNING id, label, radius_meters`,
          [surveyId, dto.label ?? null, point, dto.radiusMeters],
        );
      }
    }

    await this.pool.query(
      `UPDATE surveys SET target_geofence_id = $1 WHERE id = $2`,
      [row.rows[0].id, surveyId],
    );

    return row.rows[0];
  }

  private async assertOwned(clientId: string, surveyId: string) {
    const result = await this.pool.query(
      `SELECT * FROM surveys WHERE id = $1 AND client_id = $2`,
      [surveyId, clientId],
    );
    if (!result.rowCount) throw new NotFoundException('Survey not found');
    return result.rows[0];
  }
}
