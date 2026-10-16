import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { AdultFeedbackKind } from '../adult-feedback.enum';
import { ADULT_FEEDBACK_TEXT_MAX_LENGTH } from '../adult-feedback.constants';

/**
 * Exactly two fields. No attachment, no link field, no reply address and
 * no player id — the sender comes from the session, and the global
 * ValidationPipe (`forbidNonWhitelisted`) turns anything else into a 400.
 */
export class CreateAdultFeedbackDto {
  @IsEnum(AdultFeedbackKind)
  kind!: AdultFeedbackKind;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(ADULT_FEEDBACK_TEXT_MAX_LENGTH)
  text!: string;
}
