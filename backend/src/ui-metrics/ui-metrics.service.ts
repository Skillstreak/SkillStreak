import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UiCountItemDto } from './dto/ui-count-item.dto';
import { UiClickCount, UiCounterKey } from './entities/ui-click-count.entity';
import {
  UI_METRICS_DEFAULT_DAYS,
  UI_METRICS_MAX_BATCH,
  UI_METRICS_MIN_SENDERS,
  UI_METRICS_RETENTION_DAYS,
} from './ui-metrics.constants';

export interface UiMetricRow {
  key: UiCounterKey;
  day: string;
  senders: number;
  /** `null` when `suppressed` — the count is never sent below the floor. */
  count: number | null;
  suppressed: boolean;
}

/** The Europe/Stockholm calendar date, evaluated by Postgres. */
export const STOCKHOLM_TODAY_SQL = `(now() AT TIME ZONE 'Europe/Stockholm')::date`;

@Injectable()
export class UiMetricsService {
  constructor(
    @InjectRepository(UiClickCount)
    private readonly counts: Repository<UiClickCount>,
  ) {}

  /**
   * Adds a batch to today's counters.
   *
   * One UPSERT statement, so concurrent batches cannot lose an increment
   * (Postgres adds under the row lock the conflict takes). Keys must be
   * unique within the batch: `ON CONFLICT DO UPDATE` refuses to touch the
   * same row twice in one statement. `senders` counts calls, not people —
   * nothing identifying the caller is ever passed in.
   */
  async recordCounts(items: UiCountItemDto[]): Promise<void> {
    if (items.length === 0 || items.length > UI_METRICS_MAX_BATCH) {
      throw new BadRequestException('ui_metrics_batch_size_invalid');
    }
    const keys = items.map((i) => i.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('ui_metrics_duplicate_keys');
    }
    await this.counts.query(
      `INSERT INTO ui_click_count ("key", day, "count", senders)
       SELECT k, ${STOCKHOLM_TODAY_SQL}, n, 1
       FROM unnest($1::text[], $2::int[]) AS t(k, n)
       ON CONFLICT ("key", day)
       DO UPDATE SET "count" = ui_click_count."count" + EXCLUDED."count",
                     senders = ui_click_count.senders + 1`,
      [keys, items.map((i) => i.count)],
    );
  }

  /**
   * Per (key, day) totals for the admin view, with small cohorts hidden.
   *
   * The `senders < 10` floor is applied here on the server, so a client
   * that ignores the flag still never receives the number.
   */
  async collect(days: number = UI_METRICS_DEFAULT_DAYS): Promise<UiMetricRow[]> {
    const window = Math.min(
      Math.max(Math.trunc(days), 1),
      UI_METRICS_RETENTION_DAYS,
    );
    const rows: Array<{
      key: UiCounterKey;
      day: string;
      count: number;
      senders: number;
    }> = await this.counts.query(
      `SELECT "key", day::text AS day, "count", senders
       FROM ui_click_count
       WHERE day >= ${STOCKHOLM_TODAY_SQL} - $1::int
       ORDER BY day DESC, "key" ASC`,
      [window],
    );
    return rows.map((r) => {
      const suppressed = r.senders < UI_METRICS_MIN_SENDERS;
      return {
        key: r.key,
        day: r.day,
        senders: r.senders,
        count: suppressed ? null : r.count,
        suppressed,
      };
    });
  }

  /** Deletes rows older than the retention window. Returns rows removed. */
  async deleteExpired(): Promise<number> {
    const [, affected] = (await this.counts.query(
      `DELETE FROM ui_click_count
       WHERE day < ${STOCKHOLM_TODAY_SQL} - $1::int`,
      [UI_METRICS_RETENTION_DAYS],
    )) as [unknown, number];
    return affected;
  }
}
