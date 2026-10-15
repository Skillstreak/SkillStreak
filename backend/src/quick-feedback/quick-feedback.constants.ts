/**
 * I-002 — the two fixed quick-feedback questions and their allowed choices.
 * Fixed vocabulary only: there is no free text anywhere in this feature, so a
 * child cannot write about a person, a place or anyone else.
 */
export const QUICK_FEEDBACK_CHOICES = {
  fun_today: ['happy', 'meh', 'sad'],
  want_more: ['drills', 'challenges', 'badges', 'unsure'],
} as const;

export type QuickFeedbackQuestionId = keyof typeof QUICK_FEEDBACK_CHOICES;

export const QUICK_FEEDBACK_QUESTION_IDS = Object.keys(
  QUICK_FEEDBACK_CHOICES,
) as QuickFeedbackQuestionId[];

export const QUICK_FEEDBACK_ALL_CHOICES: string[] = Array.from(
  new Set(Object.values(QUICK_FEEDBACK_CHOICES).flat()),
);

/** Totals below this are never shown, so small groups cannot be guessed. */
export const QUICK_FEEDBACK_MIN_TOTAL = 10;

/** 'YYYY-Www', ISO week in Europe/Stockholm. */
export const ISO_WEEK_PATTERN = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
