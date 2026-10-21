/** Rows older than this are deleted nightly (I-003; shown to parents as "90 dagar"). */
export const RETENTION_DAYS = 90;
export const UI_METRICS_RETENTION_DAYS = RETENTION_DAYS;

/** Max elements per upload and the largest accepted body. */
export const UI_METRICS_MAX_BATCH = 20;
export const UI_METRICS_BODY_LIMIT = '10kb';

/** Admin view hides `count` for any (key, day) with fewer senders than this. */
export const UI_METRICS_MIN_SENDERS = 10;
export const UI_METRICS_DEFAULT_DAYS = 30;

/** Cross-pod run claim for the nightly sweep (seconds) and its job name. */
export const UI_METRICS_RETENTION_JOB = 'ui_metrics_retention_sweep';
export const UI_METRICS_RETENTION_LOCK_TTL_SECONDS = 3600;

/** A sweep silent for longer than this is logged as an alarm. */
export const UI_METRICS_RETENTION_STALE_HOURS = 48;
