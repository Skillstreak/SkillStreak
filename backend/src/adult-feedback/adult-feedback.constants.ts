// I-001 — free-text feedback from adult (18+) accounts, forwarded by mail.

/** Same ceiling as the mockup's text box. */
export const ADULT_FEEDBACK_TEXT_MAX_LENGTH = 1000;

/** Where the feedback goes; the idea list is filled from this mailbox. */
export const ADULT_FEEDBACK_RECIPIENT = 'hello@skillstreak.xyz';

/**
 * Minimum `currentYear - birthYear` for an account to count as an adult.
 *
 * Only the birth *year* is stored (ADR-0002), so a difference of 18 could
 * be a 17-year-old. A difference of 19 guarantees the account is at least
 * 18 whatever month they were born in. The cost — some real 18-year-olds
 * cannot send feedback for up to a year — is the right way round for a
 * child-safety gate.
 */
export const ADULT_FEEDBACK_MIN_YEAR_DIFFERENCE = 19;

export const ADULT_FEEDBACK_DAILY_CAP_MAX_PER_WINDOW = 5;
export const ADULT_FEEDBACK_DAILY_CAP_WINDOW_SECONDS = 60 * 60 * 24;
