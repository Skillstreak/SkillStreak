import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import {
  QUICK_FEEDBACK_ALL_CHOICES,
  QUICK_FEEDBACK_QUESTION_IDS,
} from '../quick-feedback.constants';

export class QuickFeedbackAnswerDto {
  @IsIn(QUICK_FEEDBACK_QUESTION_IDS)
  questionId!: string;

  @IsIn(QUICK_FEEDBACK_ALL_CHOICES)
  choice!: string;
}

/** Fixed choices only — there is no free-text field to add here. */
export class SubmitQuickFeedbackDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(QUICK_FEEDBACK_QUESTION_IDS.length)
  @ValidateNested({ each: true })
  @Type(() => QuickFeedbackAnswerDto)
  answers!: QuickFeedbackAnswerDto[];
}
