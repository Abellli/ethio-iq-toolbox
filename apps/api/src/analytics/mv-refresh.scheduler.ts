import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';

/**
 * Keeps mv_survey_daily_stats fresh without blocking reads — CONCURRENTLY
 * requires the unique index created alongside the view in schema.sql.
 * Every 2 minutes is enough headroom for Phase 1 pilot volume; revisit if
 * refreshes start taking longer than the interval once there's real traffic.
 */
@Injectable()
export class MvRefreshScheduler {
  private readonly logger = new Logger(MvRefreshScheduler.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Cron(CronExpression.EVERY_2_MINUTES)
  async refresh() {
    try {
      await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_survey_daily_stats');
    } catch (err) {
      this.logger.warn(`mv_survey_daily_stats refresh failed: ${err}`);
    }
  }
}
