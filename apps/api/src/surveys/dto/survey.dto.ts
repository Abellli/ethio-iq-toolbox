import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSurveyDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['free', 'paid'])
  tier?: string;
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['free', 'paid'])
  tier?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  incentiveAmountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetCapCents?: number;

  @IsOptional()
  targetDemographics?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxResponses?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;
}
