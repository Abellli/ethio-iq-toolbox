import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { SENTIMENT_QUEUE } from './queue.module';

export interface SentimentScoringJob {
  answerId: string;
  text: string;
}

@Processor('sentiment-scoring')
export class SentimentProcessor extends WorkerHost {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<SentimentScoringJob>) {
    const { answerId, text } = job.data;
    const analyticsUrl = this.config.get<string>('ANALYTICS_SERVICE_URL', 'http://localhost:8001');

    try {
      const res = await fetch(`${analyticsUrl}/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Sentiment service returned ${res.status}`);
      const { sentiment_score, sentiment_label } = await res.json();

      await this.pool.query(
        `UPDATE answers SET sentiment_score = $1, sentiment_label = $2 WHERE id = $3`,
        [sentiment_score, sentiment_label, answerId],
      );
    } catch (err) {
      // Sentiment is enrichment, not critical path — log and move on rather than
      // failing the whole job repeatedly if the analytics service is briefly down.
      console.error(`Sentiment scoring failed for answer ${answerId}:`, err);
    }
  }
}
