import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @IsOptional()
  @IsInt()
  ageMin?: number;

  @IsOptional()
  @IsInt()
  ageMax?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
