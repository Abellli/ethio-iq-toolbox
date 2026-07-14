import { IsUUID } from 'class-validator';
import { AnalyticsFilterDto } from './analytics-query.dto';

export class CrossTabQueryDto extends AnalyticsFilterDto {
  @IsUUID()
  rowQuestionId: string;

  @IsUUID()
  columnQuestionId: string;
}
