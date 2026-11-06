import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { tryClaimScheduledJobRunOrSkip } from '../common/scheduling/scheduled-job-run.util';
import { ErrorLogService } from '../error-log/error-log.service';
import { RedisService } from '../redis/redis.service';
import {
  RETENTION_DAYS,
  UI_METRICS_RETENTION_JOB,
  UI_METRICS_RETENTION_LOCK_TTL_SECONDS,
  UI_METRICS_RETENTION_STALE_HOURS,
} from './ui-metrics.constants';
import { UiMetricsService } from './ui-metrics.service';

/**
 * Nightly deletion of `ui_click_count` rows older than RETENTION_DAYS (90),
 * the period promised to parents. Same shape as the other retention sweeps:
 * in-process cron, one replica wins a Redis run-claim.
 *
 * A second, hourly check logs an error if no sweep has succeeded for 48 h,
 * because a stopped sweep silently breaks the retention promise.
 */
@Injectable()
export class UiMetricsRetentionService {
  private readonly logger = new Logger(UiMetricsRetentionService.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly uiMetrics: UiMetricsService,
    private readonly redisService: RedisService,
    private readonly errorLogService: ErrorLogService,
  ) {}

  @Cron('15 3 * * *', { timeZone: 'Europe/Stockholm' })
  async sweepExpired(): Promise<void> {
    if (
      !(await tryClaimScheduledJobRunOrSkip(
        this.redisService,
        this.logger,
        UI_METRICS_RETENTION_JOB,
        UI_METRICS_RETENTION_LOCK_TTL_SECONDS,
      ))
    ) {
      return;
    }
    try {
      const removed = await this.uiMetrics.deleteExpired();
      await this.redisService.recordScheduledJobSuccess(
        UI_METRICS_RETENTION_JOB,
      );
      if (removed) {
        this.logger.log(
          `Swept ${removed} ui_click_count row(s) older than ${RETENTION_DAYS} days.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to sweep ui_click_count — left for the next run: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.errorLogService.record({
        source: 'job',
        jobName: UI_METRICS_RETENTION_JOB,
        error,
      });
    }
  }

  @Cron('0 * * * *')
  async warnIfSweepStale(): Promise<void> {
    const staleMs = UI_METRICS_RETENTION_STALE_HOURS * 60 * 60 * 1000;
    let last: number | null;
    try {
      last = await this.redisService.getScheduledJobLastSuccess(
        UI_METRICS_RETENTION_JOB,
      );
    } catch {
      return; // Redis unreachable: cannot tell, the next tick will.
    }
    // No record yet: only an alarm once this process has itself been up
    // longer than the threshold, so a fresh deploy does not false-alarm.
    const reference = last ?? this.startedAt;
    if (Date.now() - reference > staleMs) {
      this.logger.error(
        `ALERT: ${UI_METRICS_RETENTION_JOB} has not succeeded for over ${UI_METRICS_RETENTION_STALE_HOURS} hours — ui_click_count may be held past ${RETENTION_DAYS} days.`,
      );
    }
  }
}
