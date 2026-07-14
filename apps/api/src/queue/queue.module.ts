import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { FraudProcessor } from './fraud.processor';
import { SentimentProcessor } from './sentiment.processor';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const FRAUD_QUEUE = 'fraud-scoring';
export const SENTIMENT_QUEUE = 'sentiment-scoring';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
    BullModule.registerQueue({ name: FRAUD_QUEUE }, { name: SENTIMENT_QUEUE }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
    },
    FraudProcessor,
    SentimentProcessor,
  ],
  exports: [BullModule, REDIS_CLIENT],
})
export class QueueModule {}
