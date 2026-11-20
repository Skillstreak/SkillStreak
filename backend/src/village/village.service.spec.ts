import {
  VILLAGE_ACTIVITY_WINDOW_MS,
  VILLAGE_ARENAS_PER_SPORT,
  VILLAGE_K_THRESHOLD,
  VILLAGE_MIN_QUALIFIED_MEMBERS,
  VILLAGE_MIN_TEAM_AGE_MS,
  VillageService,
  levelFor,
} from './village.service';

interface OwnTeam {
  id: string;
  name: string;
  sport: string;
  villageOptIn: boolean;
  isTest: boolean;
}
interface Row {
  id: string;
  name: string;
  sport: string;
}

function chain(rows: unknown[]) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(() => Promise.resolve(rows)),
  };
  return qb;
}

/**
 * `qualified` stands for what the SQL returns (qualification is done in
 * the query, asserted separately via the recorded where clauses).
 */
function setup(
  own: OwnTeam,
  qualified: Row[],
  activeIds: string[] = [],
  viewerQualifies = true,
) {
  // Two team queries: the viewer's own qualification (filtered by
  // `t.id = :teamId`) and the list of other qualifying teams.
  const viewerQb = chain(
    viewerQualifies ? [{ id: own.id, name: own.name, sport: own.sport }] : [],
  );
  const teamQb = chain(qualified);
  const logQb = chain(activeIds.map((teamId) => ({ teamId })));
  const teamRepository = {
    findOneOrFail: jest.fn(() => Promise.resolve(own)),
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(viewerQb)
      .mockReturnValue(teamQb),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
  };
  const trainingLogRepository = { createQueryBuilder: jest.fn(() => logQb) };
  const service = new VillageService(
    teamRepository as never,
    trainingLogRepository as never,
  );
  return { service, teamRepository, viewerQb, teamQb, logQb };
}

const own: OwnTeam = {
  id: 'own',
  name: 'Ackers P15',
  sport: 'FLOORBALL',
  villageOptIn: true,
  isTest: false,
};
const viewer = { teamId: 'own', canManage: false };

function rows(n: number, overrides: Partial<Row> = {}): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: 'Snabba Falkarna',
    sport: 'FLOORBALL',
    ...overrides,
  }));
}

const sport = (view: { sports: { sport: string }[] }, code = 'FLOORBALL') =>
  view.sports.find((s) => s.sport === code) as {
    level: string;
    arenas: { slot: string; name: string }[];
  };

describe('VillageService', () => {
  const now = new Date('2026-11-20T12:07:31Z');
  const bucket = new Date('2026-11-20T12:00:00Z');

  it('qualifies teams in SQL: opted in, not test, not viewer, old enough, enough approved members', async () => {
    const { service, teamQb } = setup(own, []);
    await service.getVillageView(viewer, now);
    type Clause = [string, Record<string, unknown>?];
    const clauses: Clause[] = [
      ...(teamQb.where.mock.calls as Clause[]),
      ...(teamQb.andWhere.mock.calls as Clause[]),
    ];
    const sql = clauses.map((c) => c[0]).join('\n');
    expect(sql).toContain('t.village_opt_in = true');
    expect(sql).toContain('t.is_test = false');
    expect(sql).toContain('t.id <> :viewerTeamId');
    expect(sql).toContain('t.created_at <= :createdBefore');
    expect(sql).toContain('p.team_join_status = :joinApproved');
    expect(sql).toContain('p.parental_consent_status = :consentApproved');
    // ADR-0040: distinct parent contacts, by blind index only.
    expect(sql).toContain('COUNT(DISTINCT ppi.parent_contact_index)');
    expect(sql).not.toMatch(/parent_contact[^_]/);
    const params = Object.assign(
      {},
      ...clauses.map((c) => c[1] ?? {}),
    ) as Record<string, unknown>;
    expect(params).toMatchObject({
      viewerTeamId: 'own',
      createdBefore: new Date(bucket.getTime() - VILLAGE_MIN_TEAM_AGE_MS),
      joinApproved: 'approved',
      consentApproved: 'approved',
      minMembers: VILLAGE_MIN_QUALIFIED_MEMBERS,
    });
  });

  it('returns real own-arena values and the quarter-hour bucket', async () => {
    const { service } = setup(
      { ...own, sport: 'ICE_HOCKEY', villageOptIn: false },
      [],
    );
    const view = await service.getVillageView(
      { teamId: 'own', canManage: true },
      now,
    );
    expect(view.ownArena).toEqual({
      sport: 'ICE_HOCKEY',
      name: 'Ackers P15',
      optedIn: false,
      canManage: true,
    });
    expect(view.generatedAt).toBe(bucket.toISOString());
  });

  it('is reciprocal: a viewer team that is not in gets no names and no levels, and nothing is queried', async () => {
    const { service, teamRepository, logQb } = setup(
      { ...own, villageOptIn: false },
      rows(VILLAGE_K_THRESHOLD + 5),
      ['t0', 't1', 't2', 't3'],
    );
    const view = await service.getVillageView(viewer, now);
    for (const s of view.sports) {
      expect(s).toEqual({ sport: s.sport, level: 'CALM', arenas: [] });
    }
    expect(teamRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(logQb.getRawMany).not.toHaveBeenCalled();
  });

  it('applies the same qualification to the viewer team (symmetric)', async () => {
    const { service, viewerQb, logQb } = setup(
      own,
      rows(VILLAGE_K_THRESHOLD + 5),
      ['t0', 't1', 't2'],
      false,
    );
    const view = await service.getVillageView(viewer, now);
    for (const s of view.sports) {
      expect(s).toEqual({ sport: s.sport, level: 'CALM', arenas: [] });
    }
    expect(viewerQb.andWhere).toHaveBeenCalledWith('t.id = :teamId', {
      teamId: 'own',
    });
    expect(logQb.getRawMany).not.toHaveBeenCalled();
  });

  it('treats a test team viewer as not in', async () => {
    const { service } = setup(
      { ...own, isTest: true },
      rows(VILLAGE_K_THRESHOLD),
    );
    const view = await service.getVillageView(viewer, now);
    expect(sport(view).arenas).toEqual([]);
  });

  it('lists no names and stays CALM below k', async () => {
    const { service } = setup(own, rows(VILLAGE_K_THRESHOLD - 1), [
      't0',
      't1',
      't2',
    ]);
    const view = await service.getVillageView(viewer, now);
    for (const s of view.sports) {
      expect(s.level).toBe('CALM');
      expect(s.arenas).toEqual([]);
    }
  });

  it('always lists exactly the fixed number of names once k is met', async () => {
    for (const n of [VILLAGE_K_THRESHOLD, 17, 40]) {
      const { service } = setup(own, rows(n));
      const view = await service.getVillageView(viewer, now);
      const fb = sport(view);
      expect(fb.arenas).toHaveLength(VILLAGE_ARENAS_PER_SPORT);
      expect(new Set(fb.arenas.map((a) => a.slot)).size).toBe(
        VILLAGE_ARENAS_PER_SPORT,
      );
      for (const arena of fb.arenas) expect(arena.slot).toMatch(/^s\d+$/);
    }
  });

  it('gives the same sample for every request within one bucket', async () => {
    const qualified = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i}`,
      name: i % 2 ? 'Snabba Falkarna' : 'Modiga Drakarna',
      sport: 'FLOORBALL',
    }));
    const a = await setup(own, qualified).service.getVillageView(viewer, now);
    const b = await setup(own, qualified).service.getVillageView(
      viewer,
      new Date('2026-11-20T12:14:59Z'),
    );
    expect(sport(a).arenas).toEqual(sport(b).arenas);
  });

  it('places each team under its own sport only', async () => {
    const { service } = setup(own, [
      ...rows(VILLAGE_K_THRESHOLD, { sport: 'FOOTBALL' }),
      ...rows(3).map((r, i) => ({ ...r, id: `fb${i}` })),
    ]);
    const view = await service.getVillageView(viewer, now);
    expect(sport(view, 'FOOTBALL').arenas).toHaveLength(VILLAGE_K_THRESHOLD);
    expect(sport(view).arenas).toEqual([]);
    expect(sport(view, 'ICE_HOCKEY').arenas).toEqual([]);
  });

  it('masks free-text names of other teams', async () => {
    const { service } = setup(own, [
      ...rows(VILLAGE_K_THRESHOLD - 1),
      { id: 'free', name: 'Täby F13', sport: 'FLOORBALL' },
    ]);
    const view = await service.getVillageView(viewer, now);
    const names = sport(view).arenas.map((a) => a.name);
    expect(names).not.toContain('Täby F13');
    expect(names).toContain('Klubbhjältarna');
  });

  it('bases the level on activity in the 3h window ending at the bucket start', async () => {
    const { service, logQb } = setup(own, rows(VILLAGE_K_THRESHOLD + 5), [
      't0',
      't1',
      't2',
      't3',
    ]);
    const view = await service.getVillageView(viewer, now);
    expect(sport(view).level).toBe('MANY');
    expect(logQb.andWhere).toHaveBeenCalledWith('e.created_at >= :since', {
      since: new Date(bucket.getTime() - VILLAGE_ACTIVITY_WINDOW_MS),
    });
    expect(logQb.andWhere).toHaveBeenCalledWith('e.created_at < :until', {
      until: bucket,
    });
  });

  it('ignores activity reported for teams outside the qualified set', async () => {
    const { service } = setup(own, rows(VILLAGE_K_THRESHOLD), [
      'own',
      'stranger',
    ]);
    const view = await service.getVillageView(viewer, now);
    expect(sport(view).level).toBe('CALM');
  });

  it('setOptIn updates only the given team and records who and when', async () => {
    const { service, teamRepository } = setup(own, []);
    await service.setOptIn('own', true, 'captain-1', now);
    expect(teamRepository.update).toHaveBeenCalledWith(
      { id: 'own' },
      {
        villageOptIn: true,
        villageOptInChangedAt: now,
        villageOptInChangedBy: 'captain-1',
      },
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
