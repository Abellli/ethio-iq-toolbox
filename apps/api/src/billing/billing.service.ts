import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { RequestTopupDto } from './dto/topup.dto';

@Injectable()
export class BillingService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getWallet(clientId: string) {
    const result = await this.pool.query(
      `SELECT wallet_balance_cents, plan_tier FROM corporate_clients WHERE id = $1`,
      [clientId],
    );
    if (!result.rowCount) throw new NotFoundException('Client not found');
    return { walletBalanceCents: result.rows[0].wallet_balance_cents, currency: 'ETB' };
  }

  async listTransactions(clientId: string) {
    const result = await this.pool.query(
      `SELECT id, type, amount_cents, currency, status, payment_method, payout_reference, created_at
       FROM transactions WHERE client_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [clientId],
    );
    return result.rows;
  }

  /** Weeks 5-6: "wallet top-up (manual invoice for Phase 1, payment gateway integration optional)". */
  async requestTopup(clientId: string, dto: RequestTopupDto) {
    const result = await this.pool.query(
      `INSERT INTO transactions (type, client_id, amount_cents, status, payment_method, currency)
       VALUES ('client_charge', $1, $2, 'pending', $3, 'ETB')
       RETURNING id, amount_cents, status, payment_method, created_at`,
      [clientId, dto.amountCents, dto.paymentMethod ?? null],
    );
    return {
      ...result.rows[0],
      note: 'Invoice created. An Ethio IQ Toolbox operator will confirm once payment is received.',
    };
  }

  /**
   * Operator-side confirmation that a manual invoice was paid — credits the wallet.
   * Gated to owner/admin roles; in a later phase this becomes a payment-gateway webhook instead.
   */
  async confirmTopup(clientId: string, role: string, transactionId: string) {
    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Only account owners or admins can confirm a top-up');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const tx = await client.query(
        `SELECT * FROM transactions WHERE id = $1 AND client_id = $2 FOR UPDATE`,
        [transactionId, clientId],
      );
      if (!tx.rowCount) throw new NotFoundException('Transaction not found');
      if (tx.rows[0].status !== 'pending') {
        throw new BadRequestException(`Transaction is already ${tx.rows[0].status}`);
      }

      await client.query(`UPDATE transactions SET status = 'completed' WHERE id = $1`, [transactionId]);
      await client.query(
        `UPDATE corporate_clients SET wallet_balance_cents = wallet_balance_cents + $1 WHERE id = $2`,
        [tx.rows[0].amount_cents, clientId],
      );

      await client.query('COMMIT');
      return { transactionId, status: 'completed' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Campaign & budget manager: real-time spend tracking per paid survey. */
  async getSpendBySurvey(clientId: string) {
    const result = await this.pool.query(
      `SELECT s.id AS survey_id, s.title, s.status, s.budget_cap_cents, s.incentive_amount_cents,
              COALESCE(t.spent_cents, 0) AS spent_cents,
              (SELECT count(*) FROM responses r WHERE r.survey_id = s.id AND r.status = 'verified') AS verified_responses
       FROM surveys s
       LEFT JOIN (
         SELECT r.survey_id, sum(tr.amount_cents) AS spent_cents
         FROM transactions tr
         JOIN responses r ON r.id = tr.response_id
         WHERE tr.type = 'payout' AND tr.status = 'completed'
         GROUP BY r.survey_id
       ) t ON t.survey_id = s.id
       WHERE s.client_id = $1 AND s.tier = 'paid'
       ORDER BY s.created_at DESC`,
      [clientId],
    );
    return result.rows;
  }
}
