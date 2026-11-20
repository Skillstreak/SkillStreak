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

/**
 * One finished day of one key, as the admin view returns it.
 *
 * A row under the floor carries neither `count` nor `senders`
 * (ADR-0039 Decision 5): returning `senders` would leak the very volume the
 * floor exists to hide.
 */
export type UiMetricRow =
  | { key: UiCounterKey; day: string; suppressed: true }
  | {
      key: UiCounterKey;
      day: string;
      suppressed: false;
      count: number;
      senders: number;
    };

/** What the admin view sends: the rows plus what they may be used for. */
export interface UiMetricsReport {
  advisory: string;
  rows: UiMetricRow[];
}

/** ADR-0039 Decision 6 — said in the response itself, not only in code. */
export const UI_METRICS_ADVISORY =
  'Advisory only. The upload endpoint is anonymous, so anyone can inflate ' +
  'any counter. Never use these numbers for gating, rewards or anything ' +
  'shown to players, coaches, parents or teams. Only finished days are ' +
  'shown, and days with fewer than ' +
  `${UI_METRICS_MIN_SENDERS} uploads are hidden; that hides low-volume ` +
  'days, it is not a guarantee about people.';

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
   * same row twice in one statement. `senders` counts calls, not people
   * (one phone uploads every few minutes) — nothing identifying the caller
   * is ever passed in.
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
   * Per (key, day) totals for the admin view (ADR-0039 Decision 5).
   *
   * **Finished days only** (`day < today`, Europe/Stockholm): a closed day's
   * row never changes again, so an operator cannot read today's live row
   * twice around a moment one known child used the app and difference out
   * that child's upload.
   *
   * Rows with fewer than UI_METRICS_MIN_SENDERS uploads are reduced to
   * `{ key, day, suppressed: true }` here on the server, so a client that
   * ignores the flag still never receives the numbers. App-wide only: no
   * team or player parameter exists and none may be added (Decision 1).
   */
  async collect(
    days: number = UI_METRICS_DEFAULT_DAYS,
  ): Promise<UiMetricsReport> {
    const window = Math.min(
      Math.max(Math.trunc(days), 1),
      UI_METRICS_RETENTION_DAYS,
    );
    const rows = await this.counts.query<
      Array<{ key: UiCounterKey; day: string; count: string; senders: string }>
    >(
      `SELECT "key", day::text AS day, "count"::text AS "count",
              senders::text AS senders
       FROM ui_click_count
       WHERE day < ${STOCKHOLM_TODAY_SQL}
         AND day >= ${STOCKHOLM_TODAY_SQL} - $1::int
       ORDER BY day DESC, "key" ASC`,
      [window],
    );
    return {
      advisory: UI_METRICS_ADVISORY,
      rows: rows.map((r): UiMetricRow => {
        const senders = Number(r.senders);
        if (senders < UI_METRICS_MIN_SENDERS) {
          return { key: r.key, day: r.day, suppressed: true };
        }
        return {
          key: r.key,
          day: r.day,
          suppressed: false,
          // bigint arrives as text; a day's sum stays far below 2^53.
          count: Number(r.count),
          senders,
        };
      }),
    };
  }

  /** Deletes rows older than the retention window. Returns rows removed.
   * `<=`, so with the nightly sweep no row outlives the promised 365 days. */
  async deleteExpired(): Promise<number> {
    // Typed via the generic, not an `as` cast: query<T = any>() leaves T as
    // `any` under a cast, which no-unsafe-assignment/-return reject.
    const [, affected] = await this.counts.query<[unknown, number]>(
      `DELETE FROM ui_click_count
       WHERE day <= ${STOCKHOLM_TODAY_SQL} - $1::int`,
      [UI_METRICS_RETENTION_DAYS],
    );
    return affected;
  }
}
