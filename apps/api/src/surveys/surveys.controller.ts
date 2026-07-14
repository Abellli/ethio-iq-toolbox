import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto, UpdateSurveyDto } from './dto/survey.dto';
import { SaveQuestionsDto } from './dto/question.dto';
import { UpsertGeofenceDto } from '../geofences/geofence.dto';

@UseGuards(JwtAuthGuard)
@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateSurveyDto) {
    return this.surveys.create(req.user.clientId, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.surveys.list(req.user.clientId);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.surveys.getOne(req.user.clientId, id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSurveyDto) {
    return this.surveys.update(req.user.clientId, id, dto);
  }

  /** Drag-and-drop builder canvas save — whole ordered question list at once. */
  @Post(':id/questions')
  saveQuestions(@Req() req: any, @Param('id') id: string, @Body() dto: SaveQuestionsDto) {
    return this.surveys.saveQuestions(req.user.clientId, id, dto);
  }

  @Post(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.surveys.transitionStatus(req.user.clientId, id, 'active');
  }

  @Post(':id/pause')
  pause(@Req() req: any, @Param('id') id: string) {
    return this.surveys.transitionStatus(req.user.clientId, id, 'paused');
  }

  @Post(':id/close')
  close(@Req() req: any, @Param('id') id: string) {
    return this.surveys.transitionStatus(req.user.clientId, id, 'closed');
  }

  @Post(':id/resume')
  resume(@Req() req: any, @Param('id') id: string) {
    return this.surveys.transitionStatus(req.user.clientId, id, 'active');
  }

  /** Geofence drawing tool save — polygon or center+radius. */
  @Post(':id/geofence')
  upsertGeofence(@Req() req: any, @Param('id') id: string, @Body() dto: UpsertGeofenceDto) {
    return this.surveys.upsertGeofence(req.user.clientId, id, dto);
  }
}
