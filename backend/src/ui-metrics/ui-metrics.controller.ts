import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseArrayPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UiCountItemDto } from './dto/ui-count-item.dto';
import { UI_METRICS_MAX_BATCH } from './ui-metrics.constants';
import { UiMetricsService } from './ui-metrics.service';

/**
 * I-003 anonymous click statistics: the app uploads per-key counts
 * (docs/adr/0039-anonymous-ui-click-statistics.md).
 *
 * Unauthenticated on purpose — the caller is not identified, so there is
 * nothing to leak or link. The body is a list of `{ key, count }` and
 * nothing else: no field exists for a device, player, team, time or
 * location, and `forbidNonWhitelisted` rejects any extra one.
 *
 * The caller's IP reaches only the throttler below: @nestjs/throttler keys
 * on a SHA-256 of it with a 60-second TTL in Redis. A hash of an IPv4
 * address is trivially reversible, so the short TTL is the protection, not
 * the hash. It is never written to Postgres or passed to the service.
 *
 * Whether a phone sends at all is the account's own opt-in, enforced only
 * in the app (mobile/src/api/uiMetricsClient.ts) — this endpoint cannot
 * know who is calling, by design. v1 sends only from self-verified
 * accounts; under-13 accounts never send (Decision 2).
 */
@Controller('api/v1/ui-metrics')
export class UiMetricsController {
  constructor(private readonly uiMetrics: UiMetricsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('counts')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordCounts(
    @Body(
      new ParseArrayPipe({
        items: UiCountItemDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    items: UiCountItemDto[],
  ): Promise<void> {
    if (items.length === 0 || items.length > UI_METRICS_MAX_BATCH) {
      throw new BadRequestException('ui_metrics_batch_size_invalid');
    }
    await this.uiMetrics.recordCounts(items);
  }
}
