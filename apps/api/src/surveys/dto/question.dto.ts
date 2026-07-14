import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

const QUESTION_TYPES = [
  'single_choice',
  'multi_choice',
  'scale',
  'nps',
  'open_text',
  'location',
] as const;

export class QuestionInputDto {
  // Absent for a brand-new question being created in this save; present when editing an existing one.
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn(QUESTION_TYPES)
  type: string;

  @IsString()
  prompt: string;

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

/**
 * The survey builder's canvas (center pane) saves the whole ordered
 * question list in one call — order_index is derived from array position,
 * which is what the dnd-kit reorder UI naturally produces.
 */
export class SaveQuestionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions: QuestionInputDto[];
}
