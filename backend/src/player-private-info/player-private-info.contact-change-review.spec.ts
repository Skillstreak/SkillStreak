import { PlayerPrivateInfoService } from './player-private-info.service';

// docs/adr/0012's 2026-11-08 amendment — the persistence half of the
// current address's approve/stop link: token liveness, single use, and
// that a new request can never inherit an earlier approval.

// CI-only test key (same one ci-cd.yml uses), a real 32-byte base64 value.
const TEST_KEY = 'Y2ktb25seS10ZXN0LWtleS0zMi1ieXRlcy1sb25nISE=';

function build(lockedRow: Record<string, unknown> | null = null) {
  const update = jest.fn().mockResolvedValue(undefined);
  const queryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(lockedRow),
  };
  const repo = {
    update,
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };
  const manager = { getRepository: jest.fn().mockReturnValue(repo) };
  const privateInfoRepository = {
    findOne: jest.fn().mockResolvedValue(lockedRow),
  };
  const service = new PlayerPrivateInfoService(
    privateInfoRepository as never,
    {} as never,
    { getOrThrow: jest.fn().mockReturnValue(TEST_KEY) } as never,
    {} as never,
  );
  return { service, manager, update, queryBuilder };
}

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 1_000);

describe('PlayerPrivateInfoService.setPendingContactChange — review fields', () => {
  it('stores the review token and expiry, and always resets any earlier approval', async () => {
    const { service, manager, update } = build();
    const expiresAt = future();

    await service.setPendingContactChange(manager as never, 'player-1', {
      pendingContact: 'kid@example.com',
      code: 'ABCD1234',
      expiresAt,
      review: { code: 'f'.repeat(64), expiresAt },
    });

    expect(update).toHaveBeenCalledWith(
      { playerId: 'player-1' },
      expect.objectContaining({
        contactChangeReviewCode: 'f'.repeat(64),
        contactChangeReviewCodeExpiresAt: expiresAt,
        // Without this, approving a change to B would carry over to a
        // re-request for C, which would apply the moment C confirmed.
        contactChangeApprovedByCurrentAt: null,
      }),
    );
  });

  it('clears the review fields for an approved account (review: null)', async () => {
    const { service, manager, update } = build();

    await service.setPendingContactChange(manager as never, 'player-1', {
      pendingContact: 'new@example.com',
      code: 'ABCD1234',
      expiresAt: future(),
      review: null,
    });

    expect(update).toHaveBeenCalledWith(
      { playerId: 'player-1' },
      expect.objectContaining({
        contactChangeReviewCode: null,
        contactChangeReviewCodeExpiresAt: null,
        contactChangeApprovedByCurrentAt: null,
      }),
    );
  });
});

describe('PlayerPrivateInfoService.findValidByReviewCode', () => {
  it('returns the locked row while the token is live and a change is pending', async () => {
    const row = {
      playerId: 'player-1',
      pendingParentContact: 'blob',
      contactChangeReviewCodeExpiresAt: future(),
    };
    const { service, manager, queryBuilder } = build(row);

    await expect(
      service.findValidByReviewCode(manager as never, 'f'.repeat(64)),
    ).resolves.toBe(row);
    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('returns null once the token has expired', async () => {
    const { service, manager } = build({
      playerId: 'player-1',
      pendingParentContact: 'blob',
      contactChangeReviewCodeExpiresAt: past(),
    });

    await expect(
      service.findValidByReviewCode(manager as never, 'f'.repeat(64)),
    ).resolves.toBeNull();
  });

  it('returns null when nothing is pending any more, even with an unexpired token', async () => {
    const { service, manager } = build({
      playerId: 'player-1',
      pendingParentContact: null,
      contactChangeReviewCodeExpiresAt: future(),
    });

    await expect(
      service.findValidByReviewCode(manager as never, 'f'.repeat(64)),
    ).resolves.toBeNull();
  });

  it('returns null for an unknown token', async () => {
    const { service, manager } = build(null);

    await expect(
      service.findValidByReviewCode(manager as never, 'f'.repeat(64)),
    ).resolves.toBeNull();
  });
});

describe('PlayerPrivateInfoService — single use of the review token', () => {
  it('markContactChangeApprovedByCurrent consumes the token and records the approval', async () => {
    const { service, manager, update } = build();

    await service.markContactChangeApprovedByCurrent(
      manager as never,
      'player-1',
    );

    expect(update).toHaveBeenCalledWith(
      { playerId: 'player-1' },
      {
        contactChangeReviewCode: null,
        contactChangeReviewCodeExpiresAt: null,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest's own matcher typing
        contactChangeApprovedByCurrentAt: expect.any(Date),
      },
    );
  });

  it('applyPendingContactChangeNow moves the pending value live and leaves no pending state behind', async () => {
    const { service, manager, update } = build();

    await service.applyPendingContactChangeNow(
      manager as never,
      {
        playerId: 'player-1',
        pendingParentContact: 'new-ciphertext',
      } as never,
    );

    expect(update).toHaveBeenCalledWith(
      { playerId: 'player-1' },
      {
        parentContact: 'new-ciphertext',
        pendingParentContact: null,
        contactChangeCode: null,
        contactChangeCodeExpiresAt: null,
        contactChangeApplyAt: null,
        contactChangeCancelCode: null,
        contactChangeReviewCode: null,
        contactChangeReviewCodeExpiresAt: null,
        contactChangeApprovedByCurrentAt: null,
      },
    );
  });

  it('cancelPendingContactChange (the stop path) clears the review token too', async () => {
    const { service, manager, update } = build();

    await service.cancelPendingContactChange(manager as never, 'player-1');

    expect(update).toHaveBeenCalledWith(
      { playerId: 'player-1' },
      expect.objectContaining({
        pendingParentContact: null,
        contactChangeReviewCode: null,
        contactChangeReviewCodeExpiresAt: null,
        contactChangeApprovedByCurrentAt: null,
      }),
    );
  });
});
