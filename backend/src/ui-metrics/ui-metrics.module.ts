import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLogModule } from '../error-log/error-log.module';
import { RedisModule } from '../redis/redis.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AdminUiMetricsController } from './admin-ui-metrics.controller';
import { UiClickCount } from './entities/ui-click-count.entity';
import { UiMetricsRetentionService } from './ui-metrics-retention.service';
import { UiMetricsController } from './ui-metrics.controller';
import { UiMetricsService } from './ui-metrics.service';

/** I-003 — anonymous, opt-in UI click statistics. See the controller. */
@Module({
  imports: [
    TypeOrmModule.forFeature([UiClickCount]),
    StaffAuthModule,
    RedisModule,
    ErrorLogModule,
  ],
  controllers: [UiMetricsController, AdminUiMetricsController],
  providers: [UiMetricsService, UiMetricsRetentionService],
})
export class UiMetricsModule {}
