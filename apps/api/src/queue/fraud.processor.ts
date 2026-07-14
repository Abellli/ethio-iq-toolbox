import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { FRAUD_QUEUE } from './queue.module';

const FRAUD_THRESHOLD = 0.6; // score >= this gets flagged for review instead of auto-verified

export interface FraudScoringJob {
  responseId: string;
}

@Processor(FRAUD_QUEUE)
export class FraudProcessor extends WorkerHost {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async process(job: Job<FraudScoringJob>) {
    const { responseId } = job.data;

    const responseRow = await this.pool.query(
      `SELECT r.*, s.tier, s.incentive_amount_cents, s.budget_cap_cents, s.client_id
       FROM responses r
       JOIN surveys s ON s.id = r.survey_id
       WHERE r.id = $1`,
      [responseId],
    );
    if (!responseRow.rowCount) return;
    const response = responseRow.rows[0];

    const score = await this.computeFraudScore(response);
    const flagged = score >= FRAUD_THRESHOLD;
    const outsideGeofence = response.is_within_geofence === false;

    const finalStatus = flagged || outsideGeofence ? 'flagged' : 'verified';

    await this.pool.query(`UPDATE responses SET fraud_score = $1, status = $2 WHERE id = $3`, [
      score,
      finalStatus,
      responseId,
    ]);

    if (flagged) {
      await this.pool.query(
        `INSERT INTO fraud_logs (response_id, reason, action_taken)
         VALUES ($1, $2, 'flagged_for_review')`,
        [responseId, 'velocity_flag'],
      );
    } else if (outsideGeofence) {
      await this.pool.query(
        `INSERT INTO fraud_logs (response_id, reason, action_taken)
         VALUES ($1, 'outside_geofence', 'flagged_for_review')`,
        [responseId],
      );
    } else {
      await this.pool.query(
        `INSERT INTO fraud_logs (response_id, reason, action_taken)
         VALUES ($1, 'velocity_flag', 'auto_approved')`,
        [responseId],
      );
    }

    if (finalStatus === 'verified' && response.tier === 'paid' && response.incentive_amount_cents > 0) {
      await this.tryPayout(response);
    }
  }

  /**
   * Heuristic v1 — device reuse rate, submission speed, IP reuse across the
   * same survey. Real implementation should also weigh account age and
   * historical fraud_logs for this device/IP; this is enough to unblock the
   * pipeline end-to-end for Phase 1 pilots.
   */
  private async computeFraudScore(response: any): Promise<number> {
    let score = 0;

    const deviceReuse = await this.pool.query(
      `SELECT count(*) FROM responses WHERE device_fingerprint_hash = $1 AND survey_id != $2`,
      [response.device_fingerprint_hash, response.survey_id],
    );
    if (Number(deviceReuse.rows[0].count) > 20) score += 0.3;

    if (response.completion_seconds !== null && response.completion_seconds < 5) {
      score += 0.4; // implausibly fast completion
    }

    const ipReuse = await this.pool.query(
      `SELECT count(*) FROM responses WHERE ip_hash = $1 AND survey_id = $2`,
      [response.ip_hash, response.survey_id],
    );
    if (Number(ipReuse.rows[0].count) > 3) score += 0.3;

    return Math.min(1, score);
  }

  /** Budget-cap-aware payout — ties fraud verification back into the wallet (Weeks 5-6). */
  private async tryPayout(response: any) {
    const spent = await this.pool.query(
      `SELECT COALESCE(sum(amount_cents), 0) AS total
       FROM transactions
       WHERE type = 'payout' AND status = 'completed'
         AND response_id IN (SELECT id FROM responses WHERE survey_id = $1)`,
      [response.survey_id],
    );
    const alreadySpent = Number(spent.rows[0].total);
    const budgetCap = response.budget_cap_cents;

    if (budgetCap !== null && alreadySpent + response.incentive_amount_cents > budgetCap) {
      // Budget exhausted — auto-pause the survey so it stops accepting paid submissions.
      await this.pool.query(`UPDATE surveys SET status = 'paused' WHERE id = $1`, [
        response.survey_id,
      ]);
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO transactions (type, respondent_id, client_id, response_id, amount_cents, status, currency)
         VALUES ('payout', $1, $2, $3, $4, 'completed', 'ETB')`,
        [response.respondent_id, response.client_id, response.id, response.incentive_amount_cents],
      );
      await client.query(
        `UPDATE corporate_clients SET wallet_balance_cents = wallet_balance_cents - $1 WHERE id = $2`,
        [response.incentive_amount_cents, response.client_id],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
