import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../staff-auth/guards/admin-auth.guard';
import { UiMetricsReport, UiMetricsService } from './ui-metrics.service';

/**
 * Admin-only (not coach/PT/player) view of the anonymous UI counters.
 *
 * App-wide: there is no team or player parameter and none may be added
 * (docs/adr/0039 Decision 1). Finished days only, low-volume days hidden
 * (Decision 5), and the response states that the numbers are advisory and
 * forgeable (Decision 6).
 */
@Controller('api/v1/admin/ui-metrics')
@UseGuards(AdminAuthGuard)
export class AdminUiMetricsController {
  constructor(private readonly uiMetrics: UiMetricsService) {}

  @Get()
  collect(@Query('days') days?: string): Promise<UiMetricsReport> {
    const parsed = Number(days);
    return this.uiMetrics.collect(
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    );
  }
}
