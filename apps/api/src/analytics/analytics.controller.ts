import { Controller, Get, Header, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-query.dto';
import { CrossTabQueryDto } from './dto/crosstab-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('analytics/surveys/:id')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('kpis')
  getKpis(@Req() req: any, @Param('id') id: string, @Query() filter: AnalyticsFilterDto) {
    return this.analytics.getKpis(req.user.clientId, id, filter);
  }

  @Get('sentiment-breakdown')
  getSentiment(@Req() req: any, @Param('id') id: string, @Query() filter: AnalyticsFilterDto) {
    return this.analytics.getSentimentBreakdown(req.user.clientId, id, filter);
  }

  @Get('trend')
  getTrend(@Req() req: any, @Param('id') id: string, @Query() filter: AnalyticsFilterDto) {
    return this.analytics.getTrend(req.user.clientId, id, filter);
  }

  @Get('crosstab')
  getCrossTab(@Req() req: any, @Param('id') id: string, @Query() query: CrossTabQueryDto) {
    return this.analytics.getCrossTab(req.user.clientId, id, query);
  }

  @Get('heatmap')
  getHeatmap(@Req() req: any, @Param('id') id: string, @Query() filter: AnalyticsFilterDto) {
    return this.analytics.getHeatmapPoints(req.user.clientId, id, filter);
  }

  @Get('sunburst')
  getSunburst(@Req() req: any, @Param('id') id: string, @Query() filter: AnalyticsFilterDto) {
    return this.analytics.getSunburstData(req.user.clientId, id, filter);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @Req() req: any,
    @Param('id') id: string,
    @Query() filter: AnalyticsFilterDto,
    @Res() res: Response,
  ) {
    const csv = await this.analytics.exportCsv(req.user.clientId, id, filter);
    res.setHeader('Content-Disposition', `attachment; filename="survey-${id}-export.csv"`);
    res.send(csv);
  }
}
