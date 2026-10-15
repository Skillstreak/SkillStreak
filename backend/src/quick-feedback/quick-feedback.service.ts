import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FeedbackAlreadyGivenException,
  InvalidQuickFeedbackAnswersException,
} from '../common/errors/exceptions';
import { RedisService } from '../redis/redis.service';
import { SubmitQuickFeedbackDto } from './dto/submit-quick-feedback.dto';
import { QuickFeedbackAnswer } from './entities/quick-feedback-answer.entity';
import {
  currentStockholmIsoWeek,
  secondsUntilStockholmWeekEnd,
} from './iso-week.util';
import {
  QUICK_FEEDBACK_CHOICES,
  QuickFeedbackQuestionId,
} from './quick-feedback.constants';

/**
 * I-002 — anonymous quick feedback from players.
 *
 * Saved rows carry question, choice and ISO week only. `playerId` is used
 * for exactly one thing: the once-a-week Redis gate. It is never passed to
 * the repository, so no code path can store it with an answer. Gating is
 * not consent-gated (like bug reports): nothing here reaches a peer.
 */
@Injectable()
export class QuickFeedbackService {
  constructor(
    @InjectRepository(QuickFeedbackAnswer)
    private readonly answerRepository: Repository<QuickFeedbackAnswer>,
    private readonly redisService: RedisService,
  ) {}

  async submit(playerId: string, dto: SubmitQuickFeedbackDto): Promise<void> {
    const seen = new Set<string>();
    for (const answer of dto.answers) {
      const allowed: readonly string[] =
        QUICK_FEEDBACK_CHOICES[answer.questionId as QuickFeedbackQuestionId];
      if (seen.has(answer.questionId) || !allowed.includes(answer.choice)) {
        throw new InvalidQuickFeedbackAnswersException();
      }
      seen.add(answer.questionId);
    }

    const now = new Date();
    const isoWeek = currentStockholmIsoWeek(now);
    const claimed = await this.redisService.tryClaimQuickFeedbackWeek(
      playerId,
      isoWeek,
      secondsUntilStockholmWeekEnd(now),
    );
    if (!claimed) {
      throw new FeedbackAlreadyGivenException();
    }

    try {
      await this.answerRepository.insert(
        dto.answers.map((answer) => ({
          questionId: answer.questionId,
          choice: answer.choice,
          isoWeek,
        })),
      );
    } catch (error) {
      await this.redisService.releaseQuickFeedbackWeek(playerId, isoWeek);
      throw error;
    }
  }
}
