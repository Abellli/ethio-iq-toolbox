import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { SubmissionsService } from './submissions.service';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Controller('public/surveys')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get(':id')
  getSurvey(@Param('id') id: string) {
    return this.submissions.getPublicSurvey(id);
  }

  @Post(':id/responses')
  submit(@Req() req: Request, @Param('id') id: string, @Body() dto: SubmitResponseDto) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';
    return this.submissions.submit(id, ip, dto);
  }
}
