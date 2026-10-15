import { AdminQuickFeedbackService } from './admin-quick-feedback.service';

function build(rows: { questionId: string; choice: string; count: string }[]) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  return new AdminQuickFeedbackService(repo as never);
}

describe('AdminQuickFeedbackService', () => {
  it('hides counts below 10 answers and shows them from 10', async () => {
    const service = build([
      { questionId: 'fun_today', choice: 'happy', count: '7' },
      { questionId: 'fun_today', choice: 'sad', count: '3' },
      { questionId: 'want_more', choice: 'drills', count: '4' },
    ]);
    const result = await service.totals('2026-W42');
    expect(result.week).toBe('2026-W42');
    const fun = result.questions.find((q) => q.questionId === 'fun_today');
    expect(fun).toEqual({
      questionId: 'fun_today',
      total: 10,
      counts: { happy: 7, meh: 0, sad: 3 },
    });
    const more = result.questions.find((q) => q.questionId === 'want_more');
    expect(more).toEqual({ questionId: 'want_more', total: 4, counts: null });
  });
});
