import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class AnswerInputDto {
  @IsUUID()
  questionId: string;

  // string | string[] | number — kept loose since it maps straight to JSONB.
  // @IsDefined (not just untyped) so ValidationPipe's whitelist:true doesn't strip it.
  @IsDefined()
  answerValue: unknown;
}

export class SubmitResponseDto {
  @IsString()
  deviceFingerprintHash: string;

  @IsOptional()
  @IsString()
  telegramIdHash?: string; // Phase 2 — null until the TMA writes it

  @IsOptional()
  @IsString()
  phoneHash?: string;

  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @IsOptional()
  @IsNumber()
  gpsLng?: number;

  @IsOptional()
  @IsNumber()
  gpsAccuracyMeters?: number;

  @IsOptional()
  @IsNumber()
  completionSeconds?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers: AnswerInputDto[];
}
