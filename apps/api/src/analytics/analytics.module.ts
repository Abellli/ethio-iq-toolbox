import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MvRefreshScheduler } from './mv-refresh.scheduler';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, MvRefreshScheduler],
})
export class AnalyticsModule {}
