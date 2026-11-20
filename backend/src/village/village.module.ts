import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PlayerPrivateInfoModule } from '../player-private-info/player-private-info.module';
import { Player } from '../players/entities/player.entity';
import { PlayersModule } from '../players/players.module';
import { Team } from '../teams/entities/team.entity';
import { TrainingLogEntry } from '../training-logs/entities/training-log-entry.entity';
import { VillageController } from './village.controller';
import { VillageJoinNoticeService } from './village-join-notice.service';
import { VillageService } from './village.service';

// TrainingLogEntry is registered read-only here (same technique as
// UsageMetricsModule): the village only counts which opted-in teams logged
// anything recently, and must not get TrainingLogsModule's write paths.
@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TrainingLogEntry, Player]),
    AuthModule,
    PlayersModule,
    // ADR-0040 — the parents' join notice (mail + the one bulk contact read).
    PlayerPrivateInfoModule,
    MailModule,
  ],
  controllers: [VillageController],
  providers: [VillageService, VillageJoinNoticeService],
})
export class VillageModule {}
