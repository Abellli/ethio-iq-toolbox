import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';

@Injectable()
export class ClientsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getOwnClient(clientId: string) {
    const result = await this.pool.query(
      `SELECT id, company_name, industry, billing_email, plan_tier, wallet_balance_cents, status, created_at
       FROM corporate_clients WHERE id = $1`,
      [clientId],
    );
    if (!result.rowCount) throw new NotFoundException('Client not found');
    return result.rows[0];
  }

  async listAdminUsers(clientId: string) {
    const result = await this.pool.query(
      `SELECT id, email, role, created_at FROM client_admin_users WHERE client_id = $1 ORDER BY created_at`,
      [clientId],
    );
    return result.rows;
  }
}
