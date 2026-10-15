import { IsOptional, Matches } from 'class-validator';
import { ISO_WEEK_PATTERN } from '../../quick-feedback/quick-feedback.constants';

/** The only parameter: a week. No team or player filter exists (I-002). */
export class QuickFeedbackQueryDto {
  /** 'YYYY-Www'; omitted = the current week. */
  @IsOptional()
  @Matches(ISO_WEEK_PATTERN)
  week?: string;
}
