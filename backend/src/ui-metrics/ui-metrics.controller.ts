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
 * I-003 anonymous click statistics: the app uploads per-key counts.
 *
 * Unauthenticated on purpose — the caller is not identified, so there is
 * nothing to leak or link. The body is a list of `{ key, count }` and
 * nothing else: no field exists for a device, player, team or location, and
 * `forbidNonWhitelisted` rejects any extra one. The caller's IP is used only
 * by the Redis-backed throttler (30 calls/min, short TTL) and is never
 * written to Postgres. Whether a given child's phone sends at all is the
 * parent's opt-in, enforced in the app.
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
