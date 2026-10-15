import {
  FeedbackAlreadyGivenException,
  InvalidQuickFeedbackAnswersException,
} from '../common/errors/exceptions';
import {
  currentStockholmIsoWeek,
  isoWeekOfDate,
  secondsUntilStockholmWeekEnd,
  stockholmWeekEndEpochSeconds,
} from './iso-week.util';
import { QuickFeedbackService } from './quick-feedback.service';

const PLAYER_ID = '11111111-1111-4111-8111-111111111111';

function build(claimed = true) {
  const repo = { insert: jest.fn().mockResolvedValue(undefined) };
  const redis = {
    tryClaimQuickFeedbackWeek: jest.fn().mockResolvedValue(claimed),
    releaseQuickFeedbackWeek: jest.fn().mockResolvedValue(undefined),
  };
  const service = new QuickFeedbackService(repo as never, redis as never);
  return { service, repo, redis };
}

describe('QuickFeedbackService', () => {
  it('stores only question, choice and week — never the player id', async () => {
    const { service, repo, redis } = build();
    await service.submit(PLAYER_ID, {
      answers: [
        { questionId: 'fun_today', choice: 'happy' },
        { questionId: 'want_more', choice: 'badges' },
      ],
    });
    const calls = repo.insert.mock.calls as [Record<string, unknown>[]][];
    const rows = calls[0][0];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        'choice',
        'isoWeek',
        'questionId',
      ]);
    }
    expect(redis.tryClaimQuickFeedbackWeek).toHaveBeenCalledWith(
      PLAYER_ID,
      currentStockholmIsoWeek(),
      expect.any(Number),
    );
  });

  it('rejects a second submission in the same week and saves nothing', async () => {
    const { service, repo } = build(false);
    await expect(
      service.submit(PLAYER_ID, {
        answers: [{ questionId: 'fun_today', choice: 'sad' }],
      }),
    ).rejects.toBeInstanceOf(FeedbackAlreadyGivenException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('rejects mismatched choices and duplicate questions before claiming the week', async () => {
    const { service, redis } = build();
    await expect(
      service.submit(PLAYER_ID, {
        answers: [{ questionId: 'fun_today', choice: 'drills' }],
      }),
    ).rejects.toBeInstanceOf(InvalidQuickFeedbackAnswersException);
    await expect(
      service.submit(PLAYER_ID, {
        answers: [
          { questionId: 'fun_today', choice: 'happy' },
          { questionId: 'fun_today', choice: 'sad' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidQuickFeedbackAnswersException);
    expect(redis.tryClaimQuickFeedbackWeek).not.toHaveBeenCalled();
  });

  it('gives the weekly slot back if saving fails', async () => {
    const { service, repo, redis } = build();
    repo.insert.mockRejectedValue(new Error('db down'));
    await expect(
      service.submit(PLAYER_ID, {
        answers: [{ questionId: 'fun_today', choice: 'meh' }],
      }),
    ).rejects.toThrow('db down');
    expect(redis.releaseQuickFeedbackWeek).toHaveBeenCalled();
  });
});

describe('iso week helpers', () => {
  it('labels ISO weeks across year boundaries', () => {
    expect(isoWeekOfDate('2026-10-15')).toBe('2026-W42');
    expect(isoWeekOfDate('2026-01-01')).toBe('2026-W01');
    expect(isoWeekOfDate('2027-01-01')).toBe('2026-W53');
    expect(isoWeekOfDate('2024-12-30')).toBe('2025-W01');
  });

  it('TTL runs to the end of the Stockholm week (plus the 1h margin)', () => {
    // Sunday 2026-10-18 21:30 UTC = 23:30 Stockholm → 30 min to Monday.
    const ttl = secondsUntilStockholmWeekEnd(new Date('2026-10-18T21:30:00Z'));
    expect(ttl).toBe(30 * 60 + 3600);
    // Monday 2026-10-12 00:00 Stockholm → a full week.
    const full = secondsUntilStockholmWeekEnd(new Date('2026-10-11T22:00:00Z'));
    expect(full).toBe(7 * 86400 + 3600);
  });

  it('gives every claim in a week the same absolute expiry', () => {
    // Monday morning, Wednesday afternoon (with odd milliseconds) and late
    // Sunday of week 2026-W42: one expiry, so TTLs cannot order the players.
    const expiries = [
      '2026-10-12T05:00:00.000Z',
      '2026-10-14T13:17:42.913Z',
      '2026-10-18T21:59:59.999Z',
    ].map((t) => stockholmWeekEndEpochSeconds(new Date(t)));
    expect(new Set(expiries).size).toBe(1);
    // Monday 2026-10-19 00:00 Stockholm (22:00 UTC) plus the 1h margin.
    expect(expiries[0]).toBe(Date.UTC(2026, 9, 18, 23, 0, 0) / 1000);
  });
});
