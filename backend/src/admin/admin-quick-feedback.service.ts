import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuickFeedbackAnswer } from '../quick-feedback/entities/quick-feedback-answer.entity';
import { currentStockholmIsoWeek } from '../quick-feedback/iso-week.util';
import {
  QUICK_FEEDBACK_CHOICES,
  QUICK_FEEDBACK_MIN_TOTAL,
  QUICK_FEEDBACK_QUESTION_IDS,
} from '../quick-feedback/quick-feedback.constants';

export interface AdminQuickFeedbackResponse {
  week: string;
  questions: {
    questionId: string;
    total: number;
    /** null while total < QUICK_FEEDBACK_MIN_TOTAL. */
    counts: Record<string, number> | null;
  }[];
}

/** I-002 — whole-app weekly totals. Nothing per team or per player exists
 * in the table to report. */
@Injectable()
export class AdminQuickFeedbackService {
  constructor(
    @InjectRepository(QuickFeedbackAnswer)
    private readonly answerRepository: Repository<QuickFeedbackAnswer>,
  ) {}

  async totals(week?: string): Promise<AdminQuickFeedbackResponse> {
    const isoWeek = week ?? currentStockholmIsoWeek();
    const rows = await this.answerRepository
      .createQueryBuilder('a')
      .select('a.question_id', 'questionId')
      .addSelect('a.choice', 'choice')
      .addSelect('COUNT(*)', 'count')
      .where('a.iso_week = :isoWeek', { isoWeek })
      .groupBy('a.question_id')
      .addGroupBy('a.choice')
      .getRawMany<{ questionId: string; choice: string; count: string }>();

    return {
      week: isoWeek,
      questions: QUICK_FEEDBACK_QUESTION_IDS.map((questionId) => {
        const counts: Record<string, number> = {};
        for (const choice of QUICK_FEEDBACK_CHOICES[questionId]) {
          counts[choice] = 0;
        }
        let total = 0;
        for (const row of rows) {
          if (row.questionId === questionId) {
            counts[row.choice] = Number(row.count);
            total += Number(row.count);
          }
        }
        return {
          questionId,
          total,
          counts: total < QUICK_FEEDBACK_MIN_TOTAL ? null : counts,
        };
      }),
    };
  }
}
