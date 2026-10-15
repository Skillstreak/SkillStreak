import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { QuickFeedbackAnswer } from './entities/quick-feedback-answer.entity';
import { QuickFeedbackController } from './quick-feedback.controller';
import { QuickFeedbackService } from './quick-feedback.service';

/** I-002 — anonymous quick feedback (player-facing submit). */
@Module({
  imports: [
    TypeOrmModule.forFeature([QuickFeedbackAnswer]),
    AuthModule,
    RedisModule,
  ],
  controllers: [QuickFeedbackController],
  providers: [QuickFeedbackService],
  exports: [TypeOrmModule],
})
export class QuickFeedbackModule {}
