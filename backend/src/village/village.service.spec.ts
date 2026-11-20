import { Not } from 'typeorm';
import type { Team } from '../teams/entities/team.entity';
import {
  VILLAGE_ACTIVITY_WINDOW_MS,
  VILLAGE_K_THRESHOLD,
  VillageService,
  levelFor,
} from './village.service';

type TeamRow = Pick<Team, 'id' | 'name' | 'sport' | 'villageOptIn' | 'isTest'>;

function team(id: string, overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id,
    name: 'Snabba Falkarna',
    sport: 'FLOORBALL',
    villageOptIn: true,
    isTest: false,
    ...overrides,
  };
}

/**
 * The repository mock applies the same filter the real `find` would
 * (opted in, not test, not the viewer), so a test that forgets one of
 * those conditions in the service fails here rather than passing on a
 * pre-filtered fixture.
 */
function setup(own: TeamRow, all: TeamRow[], activeIds: string[] = []) {
  const teamRepository = {
    findOneOrFail: jest.fn(() => Promise.resolve(own)),
    find: jest.fn(
      ({ where }: { where: { villageOptIn: boolean; isTest: boolean } }) =>
        Promise.resolve(
          all.filter(
            (t) =>
              t.villageOptIn === where.villageOptIn &&
              t.isTest === where.isTest &&
              t.id !== own.id,
          ),
        ),
    ),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
  };
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(() =>
      Promise.resolve(activeIds.map((teamId) => ({ teamId }))),
    ),
  };
  const trainingLogRepository = { createQueryBuilder: jest.fn(() => qb) };
  const service = new VillageService(
    teamRepository as never,
    trainingLogRepository as never,
  );
  return { service, teamRepository, qb };
}

function many(n: number, overrides: Partial<TeamRow> = {}): TeamRow[] {
  return Array.from({ length: n }, (_, i) => team(`t${i}`, overrides));
}

const floorball = (view: { sports: { sport: string }[] }) =>
  view.sports.find((s) => s.sport === 'FLOORBALL') as {
    level: string;
    arenas: { slot: string; name: string }[];
  };

describe('VillageService', () => {
  const own = team('own', { name: 'Ackers P15' });

  it('queries only opted-in, non-test teams other than the viewer', async () => {
    const { service, teamRepository } = setup(own, []);
    await service.getVillageView({ teamId: 'own', canManage: false });
    expect(teamRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { villageOptIn: true, isTest: false, id: Not('own') },
      }),
    );
  });

  it('returns real own-arena values, not hard-coded ones', async () => {
    const ownHockey = team('own', {
      name: 'Ackers P15',
      sport: 'ICE_HOCKEY',
      villageOptIn: false,
    });
    const { service } = setup(ownHockey, []);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: true,
    });
    expect(view.ownArena).toEqual({
      sport: 'ICE_HOCKEY',
      name: 'Ackers P15',
      optedIn: false,
      canManage: true,
    });
  });

  it('lists no names and stays CALM below k other opted-in teams', async () => {
    const others = many(VILLAGE_K_THRESHOLD - 1);
    const { service } = setup(own, [own, ...others], ['t0', 't1', 't2']);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    for (const sport of view.sports) {
      expect(sport.level).toBe('CALM');
      expect(sport.arenas).toEqual([]);
    }
  });

  it('does not count teams that have not opted in, or test teams, toward k', async () => {
    const others = [
      ...many(VILLAGE_K_THRESHOLD - 1),
      team('off', { villageOptIn: false }),
      team('test', { isTest: true }),
    ];
    const { service } = setup(own, [own, ...others]);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    expect(floorball(view).arenas).toEqual([]);
  });

  it('lists names at k once the viewer team is opted in', async () => {
    const others = many(VILLAGE_K_THRESHOLD);
    const { service } = setup(own, [own, ...others]);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    const fb = floorball(view);
    expect(fb.arenas).toHaveLength(VILLAGE_K_THRESHOLD);
    expect(new Set(fb.arenas.map((a) => a.slot)).size).toBe(
      VILLAGE_K_THRESHOLD,
    );
    for (const arena of fb.arenas) {
      expect(arena.slot).toMatch(/^s\d+$/);
      expect(arena.name).toBe('Snabba Falkarna');
    }
    // The viewer's own team is never among the arenas.
    expect(fb.arenas.map((a) => a.name)).not.toContain('Ackers P15');
  });

  it('is reciprocal: a viewer team that has not opted in sees no names', async () => {
    const ownOff = team('own', { villageOptIn: false });
    const others = many(VILLAGE_K_THRESHOLD + 2);
    const { service } = setup(ownOff, [ownOff, ...others]);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    expect(floorball(view).arenas).toEqual([]);
  });

  it('places each team under its own sport only', async () => {
    const others = [
      ...many(VILLAGE_K_THRESHOLD, { sport: 'FOOTBALL' }),
      ...Array.from({ length: 3 }, (_, i) => team(`fb${i}`)),
    ];
    const { service } = setup(own, [own, ...others]);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    const football = view.sports.find((s) => s.sport === 'FOOTBALL');
    expect(football?.arenas).toHaveLength(VILLAGE_K_THRESHOLD);
    // 3 floorball teams is below k, so floorball lists nothing.
    expect(floorball(view).arenas).toEqual([]);
    expect(view.sports.find((s) => s.sport === 'ICE_HOCKEY')?.arenas).toEqual(
      [],
    );
  });

  it('masks free-text names of other teams', async () => {
    const others = [
      ...many(VILLAGE_K_THRESHOLD - 1),
      team('free', { name: 'Täby F13' }),
    ];
    const { service } = setup(own, [own, ...others]);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    const names = floorball(view).arenas.map((a) => a.name);
    expect(names).not.toContain('Täby F13');
    expect(names).toContain('Klubbhjältarna');
  });

  it('caps the names per sport', async () => {
    const others = many(40);
    const { service } = setup(own, [own, ...others]);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    expect(floorball(view).arenas).toHaveLength(25);
  });

  it('bases the level on recent activity of other opted-in teams', async () => {
    const others = many(VILLAGE_K_THRESHOLD + 5);
    const now = new Date('2026-11-20T12:07:31Z');
    const { service, qb } = setup(
      own,
      [own, ...others],
      ['t0', 't1', 't2', 't3'],
    );
    const view = await service.getVillageView(
      { teamId: 'own', canManage: false },
      now,
    );
    expect(floorball(view).level).toBe('MANY');
    expect(qb.andWhere).toHaveBeenCalledWith('e.created_at >= :since', {
      since: new Date(now.getTime() - VILLAGE_ACTIVITY_WINDOW_MS),
    });
    expect(view.generatedAt).toBe('2026-11-20T12:00:00.000Z');
  });

  it('ignores activity reported for teams outside the opted-in set', async () => {
    const others = many(VILLAGE_K_THRESHOLD);
    const { service } = setup(own, [own, ...others], ['own', 'stranger']);
    const view = await service.getVillageView({
      teamId: 'own',
      canManage: false,
    });
    expect(floorball(view).level).toBe('CALM');
  });

  it('setOptIn updates only the given team', async () => {
    const { service, teamRepository } = setup(own, []);
    await service.setOptIn('own', true);
    expect(teamRepository.update).toHaveBeenCalledWith(
      { id: 'own' },
      { villageOptIn: true },
    );
  });
});

describe('levelFor', () => {
  it.each([
    [0, 'CALM'],
    [1, 'SOME'],
    [2, 'SOME'],
    [3, 'MANY'],
    [5, 'MANY'],
    [6, 'VERY_MANY'],
    [50, 'VERY_MANY'],
  ])('%i active teams -> %s', (n, level) => {
    expect(levelFor(n)).toBe(level);
  });
});
