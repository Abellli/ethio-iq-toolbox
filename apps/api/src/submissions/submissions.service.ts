import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { PG_POOL } from '../config/database.module';
import { REDIS_CLIENT, FRAUD_QUEUE, SENTIMENT_QUEUE } from '../queue/queue.module';
import { SubmitResponseDto } from './dto/submit-response.dto';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 10; // per IP, across all surveys
const DEDUP_LOCK_TTL_SECONDS = 30; // just long enough to cover one submission round-trip

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(FRAUD_QUEUE) private readonly fraudQueue: Queue,
    @InjectQueue(SENTIMENT_QUEUE) private readonly sentimentQueue: Queue,
  ) {}

  /** Public — used by the web-form fallback (and later the TMA) to render a survey. */
  async getPublicSurvey(surveyId: string) {
    const survey = await this.pool.query(
      `SELECT s.id, s.title, s.description, s.tier, s.incentive_amount_cents, s.incentive_currency, s.status
       FROM surveys s WHERE s.id = $1 AND s.status = 'active'`,
      [surveyId],
    );
    if (!survey.rowCount) throw new NotFoundException('Survey not found or not currently active');

    const questions = await this.pool.query(
      `SELECT id, type, prompt, config, is_required FROM questions
       WHERE survey_id = $1 ORDER BY order_index ASC`,
      [surveyId],
    );

    return { ...survey.rows[0], questions: questions.rows };
  }

  async submit(surveyId: string, ip: string, dto: SubmitResponseDto) {
    const ipHash = sha256(ip);

    // --- Redis: IP velocity limit, checked before touching Postgres at all ---
    const rateLimitKey = `ratelimit:ip:${ipHash}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
    if (count > RATE_LIMIT_MAX_PER_WINDOW) {
      throw new BadRequestException('Too many submissions from this connection, try again shortly');
    }

    // --- Redis: fast dedup lock (device + survey) ahead of the DB unique constraint ---
    const dedupKey = `dedup:${surveyId}:${dto.deviceFingerprintHash}`;
    const acquired = await this.redis.set(dedupKey, '1', 'EX', DEDUP_LOCK_TTL_SECONDS, 'NX');
    if (!acquired) {
      throw new ConflictException('A submission for this survey is already in progress');
    }

    try {
      const survey = await this.pool.query(
        `SELECT id, status, max_responses,
                (SELECT count(*) FROM responses WHERE survey_id = surveys.id) AS response_count
         FROM surveys WHERE id = $1`,
        [surveyId],
      );
      if (!survey.rowCount || survey.rows[0].status !== 'active') {
        throw new BadRequestException('This survey is not currently accepting responses');
      }
      if (
        survey.rows[0].max_responses !== null &&
        Number(survey.rows[0].response_count) >= survey.rows[0].max_responses
      ) {
        throw new BadRequestException('This survey has reached its response limit');
      }

      const respondentId = await this.findOrCreateRespondent(dto);

      const questionTypes = await this.pool.query(
        `SELECT id, type FROM questions WHERE survey_id = $1`,
        [surveyId],
      );
      const typeByQuestionId = new Map<string, string>(
        questionTypes.rows.map((q) => [q.id, q.type]),
      );

      const client = await this.pool.connect();
      let responseId: string;
      const sentimentJobs: { answerId: string; text: string }[] = [];
      try {
        await client.query('BEGIN');

        let responseRow;
        try {
          responseRow = await client.query(
            `INSERT INTO responses
               (survey_id, respondent_id, ip_hash, device_fingerprint_hash, completion_seconds)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [surveyId, respondentId, ipHash, dto.deviceFingerprintHash, dto.completionSeconds ?? null],
          );
        } catch (err: any) {
          if (err.code === '23505') {
            // uq_responses_dedup — this respondent already has a submission for this survey.
            throw new ConflictException('You have already submitted a response to this survey');
          }
          throw err;
        }
        responseId = responseRow.rows[0].id;

        // --- Synchronous geofence check (section 2, "Fraud & quality control mechanics") ---
        if (dto.gpsLat !== undefined && dto.gpsLng !== undefined) {
          const point = `SRID=4326;POINT(${dto.gpsLng} ${dto.gpsLat})`;
          const geofence = await client.query(
            `SELECT center, radius_meters, area FROM geofences WHERE survey_id = $1`,
            [surveyId],
          );
          let isWithin: boolean | null = null;
          if (geofence.rowCount) {
            const g = geofence.rows[0];
            if (g.area) {
              const check = await client.query(
                `SELECT ST_Contains($1::geometry, ST_GeomFromEWKT($2)::geometry) AS within`,
                [g.area, point],
              );
              isWithin = check.rows[0].within;
            } else if (g.center && g.radius_meters) {
              const check = await client.query(
                `SELECT ST_DWithin($1::geography, ST_GeomFromEWKT($2)::geography, $3) AS within`,
                [g.center, point, g.radius_meters],
              );
              isWithin = check.rows[0].within;
            }
          }
          await client.query(
            `UPDATE responses
             SET gps_point = ST_GeomFromEWKT($1), gps_accuracy_meters = $2, is_within_geofence = $3
             WHERE id = $4`,
            [point, dto.gpsAccuracyMeters ?? null, isWithin, responseId],
          );
        }

        for (const answer of dto.answers) {
          const inserted = await client.query(
            `INSERT INTO answers (response_id, question_id, answer_value)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [responseId, answer.questionId, JSON.stringify(answer.answerValue)],
          );
          if (
            typeByQuestionId.get(answer.questionId) === 'open_text' &&
            typeof answer.answerValue === 'string' &&
            answer.answerValue.trim().length > 0
          ) {
            sentimentJobs.push({ answerId: inserted.rows[0].id, text: answer.answerValue });
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // --- Async fraud scoring (Weeks 6-8) — keeps this endpoint fast under load ---
      await this.fraudQueue.add('score', { responseId }, { removeOnComplete: true });

      // --- Async sentiment scoring (Weeks 8-11) for any open_text answers ---
      for (const job of sentimentJobs) {
        await this.sentimentQueue.add('score', job, { removeOnComplete: true });
      }

      return { responseId, status: 'pending' as const };
    } finally {
      // Release the fast dedup lock once we've either succeeded or thrown a definitive error;
      // the DB unique constraint remains the source of truth against races.
      await this.redis.del(dedupKey);
    }
  }

  private async findOrCreateRespondent(dto: SubmitResponseDto): Promise<string> {
    const existing = await this.pool.query(
      `SELECT id FROM respondents WHERE device_fingerprint_hash = $1`,
      [dto.deviceFingerprintHash],
    );
    if (existing.rowCount) return existing.rows[0].id;

    const created = await this.pool.query(
      `INSERT INTO respondents (device_fingerprint_hash, telegram_id_hash, phone_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [dto.deviceFingerprintHash, dto.telegramIdHash ?? null, dto.phoneHash ?? null],
    );
    return created.rows[0].id;
  }
}
