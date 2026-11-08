import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/errors/http-exception.filter';
import { Team } from '../src/teams/entities/team.entity';
import { TeamSeasonPot } from '../src/team-pool/entities/team-season-pot.entity';
import { Player } from '../src/players/entities/player.entity';
import { TeamsService } from '../src/teams/teams.service';

interface ApiErrorBody {
  error: { code: string; message: string };
}

interface CreatePlayerBody {
  playerId: string;
  teamId: string;
  teamName: string;
  teamCreated: boolean;
  isCaptain: boolean;
  inviteCode: string | null;
}

// Regression coverage for docs/adr/0009-self-service-team-creation.md
// Decision 8 ("the invite-code creation race — an explicit error, not a
// silent fallback"), revised for the 2026-11-08 amendment.
//
// Before that amendment, two signups typing the same not-yet-existing code
// genuinely raced for it. Now the server generates every code, so two
// concurrent signups get two codes and both succeed — the first test. The
// unique constraint on team.invite_code still decides the outcome if two
// *generated* codes ever collide, and that path must still fail cleanly
// and roll back; the second test forces a collision to prove it.
describe('Self-service team creation — invite-code race (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const runId = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  function signup(label: string, typedCode?: string) {
    return request(app.getHttpServer())
      .post('/api/v1/players')
      .send({
        ...(typedCode ? { inviteCode: typedCode } : {}),
        teamName: `Race Team ${label} ${runId}`,
        screenName: `Race${label}${randomUUID().slice(0, 6)}`,
        avatarId: 'fox',
        birthYear: 2014,
        parentContact: `race-${label.toLowerCase()}-parent@example.com`,
      });
  }

  it('two concurrent signups typing the same unknown code both create their own team, with distinct generated codes', async () => {
    const typedCode = `RACE${randomUUID().slice(0, 8).toUpperCase()}`;

    const [a, b] = await Promise.all([
      signup('A', typedCode),
      signup('B', typedCode),
    ]);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const bodyA = a.body as CreatePlayerBody;
    const bodyB = b.body as CreatePlayerBody;
    expect(bodyA.teamId).not.toBe(bodyB.teamId);
    expect(bodyA.inviteCode).not.toBe(bodyB.inviteCode);
    expect(bodyA.isCaptain && bodyB.isCaptain).toBe(true);
    // Neither team got the typed code.
    expect(
      await dataSource
        .getRepository(Team)
        .count({ where: { inviteCode: typedCode } }),
    ).toBe(0);
  });

  it('a generated-code collision fails one signup with 409 invite_code_taken_concurrently and persists nothing for it', async () => {
    const forcedCode = `ZZ${randomUUID().slice(0, 6).toUpperCase()}`;
    const teamsService: TeamsService = app.get(TeamsService);
    // Both requests get the same "unused" code — the pre-insert uniqueness
    // read cannot see the other's uncommitted row, so only the database
    // constraint can decide, exactly the race Decision 8 is about.
    const spy = jest
      .spyOn(
        teamsService as unknown as {
          pickUnusedInviteCode: () => Promise<string>;
        },
        'pickUnusedInviteCode',
      )
      .mockResolvedValue(forcedCode);

    let responses: Array<{ status: number; body: unknown }>;
    try {
      responses = await Promise.all([signup('C'), signup('D')]);
    } finally {
      spy.mockRestore();
    }

    const succeeded = responses.filter((r) => r.status === 201);
    const failed = responses.filter((r) => r.status !== 201);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe(409);
    expect((failed[0].body as ApiErrorBody).error.code).toBe(
      'invite_code_taken_concurrently',
    );

    const winner = succeeded[0].body as CreatePlayerBody;
    const teams = await dataSource
      .getRepository(Team)
      .find({ where: { inviteCode: forcedCode } });
    expect(teams).toHaveLength(1);
    expect(teams[0].id).toBe(winner.teamId);

    // The loser's whole transaction rolled back: no second team, pot or
    // captain anywhere.
    const loserName =
      winner.teamName === `Race Team C ${runId}`
        ? `Race Team D ${runId}`
        : `Race Team C ${runId}`;
    expect(
      await dataSource
        .getRepository(Team)
        .count({ where: { name: loserName } }),
    ).toBe(0);
    expect(
      await dataSource
        .getRepository(TeamSeasonPot)
        .count({ where: { teamId: winner.teamId } }),
    ).toBe(1);
    const players = await dataSource
      .getRepository(Player)
      .find({ where: { teamId: winner.teamId } });
    expect(players).toHaveLength(1);
    expect(players[0].isCaptain).toBe(true);
  });
});
