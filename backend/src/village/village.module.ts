import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlayersModule } from '../players/players.module';
import { Team } from '../teams/entities/team.entity';
import { TrainingLogEntry } from '../training-logs/entities/training-log-entry.entity';
import { VillageController } from './village.controller';
import { VillageService } from './village.service';

// TrainingLogEntry is registered read-only here (same technique as
// UsageMetricsModule): the village only counts which opted-in teams logged
// anything recently, and must not get TrainingLogsModule's write paths.
@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TrainingLogEntry]),
    AuthModule,
    PlayersModule,
  ],
  controllers: [VillageController],
  providers: [VillageService],
})
export class VillageModule {}
