import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ActivityType } from '../activity-type.enum';

export const MAX_TIMER_MINUTES = 60;

// docs/adr/0038 Decision 2 & I-010 (2026-11-12) — `POST /api/v1/training-timers`.
// Up-counting stopwatch with running points, default & max 60 minutes.
export class StartTrainingTimerDto {
  @IsEnum(ActivityType)
  activityType!: ActivityType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TIMER_MINUTES)
  plannedMinutes?: number;
}
