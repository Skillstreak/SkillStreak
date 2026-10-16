import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { Player } from '../players/entities/player.entity';
import { RedisModule } from '../redis/redis.module';
import { AdultFeedbackController } from './adult-feedback.controller';
import { AdultFeedbackService } from './adult-feedback.service';

/** I-001 — adult-only feedback by mail. Owns no table, by design. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Player]),
    AuthModule,
    RedisModule,
    MailModule,
  ],
  controllers: [AdultFeedbackController],
  providers: [AdultFeedbackService],
})
export class AdultFeedbackModule {}
