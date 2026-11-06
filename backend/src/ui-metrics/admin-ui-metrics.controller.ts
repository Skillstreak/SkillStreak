import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../staff-auth/guards/admin-auth.guard';
import { UiMetricRow, UiMetricsService } from './ui-metrics.service';

/**
 * Admin-only (not coach/PT/player) view of the anonymous UI counters.
 * App-wide: there is no team or player parameter and none may be added.
 */
@Controller('api/v1/admin/ui-metrics')
@UseGuards(AdminAuthGuard)
export class AdminUiMetricsController {
  constructor(private readonly uiMetrics: UiMetricsService) {}

  @Get()
  collect(@Query('days') days?: string): Promise<UiMetricRow[]> {
    const parsed = Number(days);
    return this.uiMetrics.collect(
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    );
  }
}
