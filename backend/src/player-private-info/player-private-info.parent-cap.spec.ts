import { parentContactIndex } from '../common/crypto/parent-contact-index.util';
import { encryptPii } from '../common/crypto/pii-encryption.util';
import { ParentTeamCapReachedException } from '../common/errors/exceptions';
import { PlayerLocale } from '../common/locale/player-locale.enum';
import {
  MAX_TEAMS_PER_PARENT_CONTACT,
  PlayerPrivateInfoService,
} from './player-private-info.service';

// CI-only test key (same one ci-cd.yml uses), a real 32-byte base64 value.
const TEST_KEY = 'Y2ktb25seS10ZXN0LWtleS0zMi1ieXRlcy1sb25nISE=';

function build(
  rows: Array<{ playerId: string; parentContact: string }> = [],
  selfVerifiedIds: string[] = [],
) {
  const privateInfoRepository = {
    find: jest.fn(() => Promise.resolve(rows)),
  };
  const consentRecordRepository = {
    find: jest.fn(() =>
      Promise.resolve(selfVerifiedIds.map((playerId) => ({ playerId }))),
    ),
  };
  const service = new PlayerPrivateInfoService(
    privateInfoRepository as never,
    consentRecordRepository as never,
    { getOrThrow: jest.fn().mockReturnValue(TEST_KEY) } as never,
    {} as never,
  );
  return { service, privateInfoRepository };
}

/** A manager whose count query reports the parent is already approved in
 * `otherTeams` distinct teams other than the one being joined. */
function managerReporting(otherTeams: number) {
  const query = jest.fn((sql: string) =>
    Promise.resolve(
      sql.includes('pg_advisory_xact_lock')
        ? []
        : [{ teams: String(otherTeams) }],
    ),
  );
  return { query };
}

describe('PlayerPrivateInfoService.assertParentTeamCapAllows (ADR-0040)', () => {
  const index = parentContactIndex('parent@example.com', TEST_KEY);

  it('the cap is 5 teams', () => {
    expect(MAX_TEAMS_PER_PARENT_CONTACT).toBe(5);
  });

  it.each([0, 1, 4])(
    'allows a parent already in %i other team(s) to be approved in one more',
    async (otherTeams) => {
      const { service } = build();
      const manager = managerReporting(otherTeams);
      await expect(
        service.assertParentTeamCapAllows(manager as never, index, 'team-new'),
      ).resolves.toBeUndefined();
    },
  );

  it.each([5, 6])(
    'refuses a parent already in %i other teams (a sixth team)',
    async (otherTeams) => {
      const { service } = build();
      const manager = managerReporting(otherTeams);
      await expect(
        service.assertParentTeamCapAllows(manager as never, index, 'team-new'),
      ).rejects.toBeInstanceOf(ParentTeamCapReachedException);
    },
  );

  it('counts only approved members, in teams other than the one joined, by index — and locks on the index, not the address', async () => {
    const { service } = build();
    const manager = managerReporting(0);
    await service.assertParentTeamCapAllows(manager as never, index, 'team-x');

    const [lockSql, lockParams] = manager.query.mock.calls[0] as unknown as [
      string,
      string[],
    ];
    expect(lockSql).toContain('pg_advisory_xact_lock');
    expect(lockParams[0]).toBe(`parent-team-cap:${index}`);
    expect(lockParams[0]).not.toContain('@');

    const [countSql, countParams] = manager.query.mock.calls[1] as unknown as [
      string,
      string[],
    ];
    expect(countSql).toContain('COUNT(DISTINCT p.team_id)');
    expect(countSql).toContain('ppi.parent_contact_index = $1');
    expect(countSql).toContain('p.team_join_status = $2');
    // Only consent-verified memberships count (security review B1).
    expect(countSql).toContain('p.parental_consent_status = $3');
    expect(countSql).toContain('p.team_id <> $4');
    expect(countParams).toEqual([index, 'approved', 'approved', 'team-x']);
  });

  it('a second child of the same parent in a team the parent is already in is not a new team', async () => {
    // The SQL excludes the joined team (p.team_id <> $3), so a parent
    // already in 5 teams, one of which is this one, reports 4 others.
    const { service } = build();
    const manager = managerReporting(MAX_TEAMS_PER_PARENT_CONTACT - 1);
    await expect(
      service.assertParentTeamCapAllows(manager as never, index, 'team-5'),
    ).resolves.toBeUndefined();
  });

  it('does nothing for a null index (unreadable legacy row)', async () => {
    const { service } = build();
    const manager = managerReporting(99);
    await service.assertParentTeamCapAllows(manager as never, null, 'team-x');
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('indexFor ignores case and surrounding whitespace in an email', () => {
    const { service } = build();
    expect(service.indexFor('  Parent@Example.COM ')).toBe(index);
  });
});

describe('PlayerPrivateInfoService.getParentEmailRecipients (ADR-0040)', () => {
  it('returns each distinct email once, skips phone contacts, carries a locale', async () => {
    const { service } = build([
      {
        playerId: 'a',
        parentContact: encryptPii('Anna@Example.com', TEST_KEY),
      },
      {
        playerId: 'b',
        parentContact: encryptPii('anna@example.com ', TEST_KEY),
      },
      {
        playerId: 'c',
        parentContact: encryptPii('+46 70 123 45 67', TEST_KEY),
      },
      { playerId: 'd', parentContact: encryptPii('bo@example.com', TEST_KEY) },
      { playerId: 'e', parentContact: 'not-a-ciphertext' },
    ]);
    const recipients = await service.getParentEmailRecipients([
      { id: 'a', locale: PlayerLocale.EN },
      { id: 'b', locale: PlayerLocale.SV },
      { id: 'c', locale: PlayerLocale.SV },
      { id: 'd', locale: PlayerLocale.FI },
      { id: 'e', locale: PlayerLocale.SV },
    ]);
    expect(recipients).toEqual([
      { email: 'Anna@Example.com', locale: PlayerLocale.EN },
      { email: 'bo@example.com', locale: PlayerLocale.FI },
    ]);
  });

  it('reads nothing for an empty team', async () => {
    const { service, privateInfoRepository } = build();
    expect(await service.getParentEmailRecipients([])).toEqual([]);
    expect(privateInfoRepository.find).not.toHaveBeenCalled();
  });

  it('skips self-verified (13+) accounts: their contact is the child, not a parent', async () => {
    const { service } = build(
      [
        {
          playerId: 'kid13',
          parentContact: encryptPii('kid@example.com', TEST_KEY),
        },
        {
          playerId: 'kid10',
          parentContact: encryptPii('mum@example.com', TEST_KEY),
        },
      ],
      ['kid13'],
    );
    const recipients = await service.getParentEmailRecipients([
      { id: 'kid13', locale: PlayerLocale.SV },
      { id: 'kid10', locale: PlayerLocale.SV },
    ]);
    expect(recipients).toEqual([
      { email: 'mum@example.com', locale: PlayerLocale.SV },
    ]);
  });
});
