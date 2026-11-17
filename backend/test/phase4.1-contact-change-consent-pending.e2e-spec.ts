import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/errors/http-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { Team } from '../src/teams/entities/team.entity';
import { Season } from '../src/team-pool/entities/season.entity';
import { TeamSeasonPot } from '../src/team-pool/entities/team-season-pot.entity';
import { TeamSeasonPotStatus } from '../src/team-pool/team-season-pot-status.enum';
import { PlayerPrivateInfo } from '../src/player-private-info/entities/player-private-info.entity';
import { Player } from '../src/players/entities/player.entity';
import { ParentalConsentStatus } from '../src/players/player-consent-status.enum';

interface ApiErrorBody {
  error: { code: string; message: string };
}

interface CreatePlayerBody {
  playerId: string;
  sessionToken: string;
  screenName: string;
}

interface ProfileBody {
  parentContact: string;
}

interface SentMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// docs/adr/0012's 2026-11-08 amendment. The gap this suite pins down, from
// the 2026-11-08 security audit: a player whose parental consent is still
// PENDING could request a contact change to their own mailbox, confirm it
// from there, wait out the 24h grace, then self-remind — minting a fresh
// consent link (killing the parent's) and mailing it to themselves. The
// approval it produced was recorded as ConsentMethod.EMAIL_LINK: a
// parental consent nobody gave.
//
// For non-APPROVED accounts the OLD address now gets an actionable mail
// (approve / stop) at request time, and consent reminders are refused
// while the change is unresolved, so the parent's existing link survives.
describe('Phase 4.1: contact change while parental consent is pending (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let inviteCode: string;
  let teamId: string;
  let sendMailSpy: jest.SpyInstance;

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
    sendMailSpy = jest.spyOn(app.get(MailService), 'sendMail');

    inviteCode = `CCP${randomUUID().slice(0, 8).toUpperCase()}`;
    const team = await dataSource
      .getRepository(Team)
      .save(
        dataSource
          .getRepository(Team)
          .create({ name: 'Contact Change Pending Team', inviteCode }),
      );
    teamId = team.id;

    const season = await dataSource.getRepository(Season).save(
      dataSource.getRepository(Season).create({
        teamId,
        label: 'CCP Season',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    );
    await dataSource.getRepository(TeamSeasonPot).save(
      dataSource.getRepository(TeamSeasonPot).create({
        teamId,
        seasonId: season.id,
        pointsTotal: 0,
        goalThreshold: 1_000_000,
        status: TeamSeasonPotStatus.ACTIVE,
      }),
    );
  });

  afterAll(async () => {
    sendMailSpy.mockRestore();
    await dataSource.getRepository(Team).delete({ id: teamId });
    await app.close();
  });

  beforeEach(() => {
    sendMailSpy.mockClear();
  });

  function mailsTo(address: string): SentMail[] {
    return (sendMailSpy.mock.calls as [SentMail][])
      .map(([mail]) => mail)
      .filter((mail) => mail.to === address);
  }

  async function createPlayer(parentContact: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/players')
      .send({
        inviteCode,
        screenName: `CCP${randomUUID().slice(0, 6)}`,
        avatarId: 'fox',
        birthYear: 2015,
        parentContact,
      })
      .expect(201);
    const body = response.body as CreatePlayerBody;
    return body;
  }

  async function readPlayer(playerId: string): Promise<Player> {
    return dataSource
      .getRepository(Player)
      .findOneOrFail({ where: { id: playerId } });
  }

  async function readInfo(playerId: string): Promise<PlayerPrivateInfo> {
    return dataSource
      .getRepository(PlayerPrivateInfo)
      .findOneOrFail({ where: { playerId } });
  }

  async function requestChange(sessionToken: string, newContact: string) {
    await request(app.getHttpServer())
      .post('/api/v1/players/me/contact-change-request')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ newContact })
      .expect(200);
  }

  async function confirmChange(playerId: string, sessionToken: string) {
    const info = await readInfo(playerId);
    expect(info.contactChangeCode).not.toBeNull();
    const response = await request(app.getHttpServer())
      .post('/api/v1/players/me/contact-change-confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code: info.contactChangeCode })
      .expect(200);
    return response.body as {
      confirmed: true;
      appliesAt: string;
      applied?: boolean;
    };
  }

  // The token as it reached the OLD address — read out of the mail itself,
  // not the DB, so the test proves the old address was actually handed a
  // usable link.
  function reviewTokenMailedTo(oldContact: string): string {
    const mails = mailsTo(oldContact);
    const tokens = mails
      .map(
        (mail) =>
          /\/api\/v1\/players\/contact-change-review\/([0-9a-f]{64})/.exec(
            mail.text,
          )?.[1],
      )
      .filter((token): token is string => token !== undefined);
    expect(tokens).toHaveLength(1);
    return tokens[0];
  }

  async function getProfileContact(sessionToken: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .get('/api/v1/players/me/profile')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);
    return (response.body as ProfileBody).parentContact;
  }

  describe('the audited attack', () => {
    it('ends with consent still pending: the self-reminder is refused and the parent’s consent link survives', async () => {
      const parent = 'ccp-attack-parent@example.com';
      const kid = 'ccp-attack-kid@example.com';
      const { playerId, sessionToken, screenName } = await createPlayer(parent);
      const parentConsentToken = (await readPlayer(playerId)).consentToken;
      expect(parentConsentToken).not.toBeNull();

      // 1. Redirect the parent contact to the child's own mailbox and
      // confirm it from there.
      await requestChange(sessionToken, kid);
      await confirmChange(playerId, sessionToken);

      // 2. Self-remind during the window — refused, and nothing minted.
      const reminder = await request(app.getHttpServer())
        .post(`/api/v1/players/${playerId}/consent-reminder`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(409);
      expect((reminder.body as ApiErrorBody).error.code).toBe(
        'consent_reminder_blocked_pending_contact_change',
      );

      const after = await readPlayer(playerId);
      expect(after.consentToken).toBe(parentConsentToken);
      expect(after.parentalConsentStatus).toBe(ParentalConsentStatus.PENDING);

      // The parent's original consent link still previews.
      const preview = await request(app.getHttpServer())
        .get(`/api/v1/consent/${parentConsentToken}`)
        .expect(200);
      expect(preview.text).toContain(screenName);

      // No consent link was ever mailed to the child's address — only the
      // contact-change confirmation code.
      for (const mail of mailsTo(kid)) {
        expect(mail.text).not.toContain('/api/v1/consent/');
      }

      // And the parent was handed an actionable approve/stop link.
      reviewTokenMailedTo(parent);
    });

    it('is dead for good once the parent presses stop: change discarded, sessions evicted, consent link intact', async () => {
      const parent = 'ccp-stop-parent@example.com';
      const kid = 'ccp-stop-kid@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);
      const parentConsentToken = (await readPlayer(playerId)).consentToken;

      await requestChange(sessionToken, kid);
      const reviewToken = reviewTokenMailedTo(parent);
      await confirmChange(playerId, sessionToken);

      const stop = await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=stop`,
        )
        .expect(200);
      expect(stop.text).toContain('Stoppat');

      const info = await readInfo(playerId);
      expect(info.pendingParentContact).toBeNull();
      expect(info.contactChangeApplyAt).toBeNull();
      expect(info.contactChangeReviewCode).toBeNull();

      // Same "this wasn't me" token_version bump as the cancel link.
      await request(app.getHttpServer())
        .get('/api/v1/players/me/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401);

      const after = await readPlayer(playerId);
      expect(after.consentToken).toBe(parentConsentToken);
      expect(after.parentalConsentStatus).toBe(ParentalConsentStatus.PENDING);

      // Single-use: the same link does nothing a second time.
      const again = await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=approve`,
        )
        .expect(200);
      expect(again.text).toContain('Länken fungerar inte längre');
    });

    // The residual the owner accepted on 2026-11-08 (ADR-0012 amendment),
    // the same one signup already carries: a parent who ignores the mail
    // for the whole grace period lets the change through. Pinned here so
    // that it stays a deliberate, documented property, not an accident.
    it('ACCEPTED RESIDUAL: after 24h of parental silence the change applies, and only then do reminders go to the new address', async () => {
      const parent = 'ccp-residual-parent@example.com';
      const kid = 'ccp-residual-kid@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);

      await requestChange(sessionToken, kid);
      await confirmChange(playerId, sessionToken);
      await dataSource
        .getRepository(PlayerPrivateInfo)
        .update(
          { playerId },
          { contactChangeApplyAt: new Date(Date.now() - 1000) },
        );

      sendMailSpy.mockClear();
      await request(app.getHttpServer())
        .post(`/api/v1/players/${playerId}/consent-reminder`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);
      expect(await getProfileContact(sessionToken)).toBe(kid);
      expect(
        mailsTo(kid).some((m) => m.text.includes('/api/v1/consent/')),
      ).toBe(true);
    });
  });

  describe('the old address’s approve / stop link', () => {
    it('GET previews without side effects; an unknown token renders the invalid page', async () => {
      const parent = 'ccp-preview-parent@example.com';
      const { playerId, sessionToken, screenName } = await createPlayer(parent);
      await requestChange(sessionToken, 'ccp-preview-new@example.com');
      const reviewToken = reviewTokenMailedTo(parent);

      const preview = await request(app.getHttpServer())
        .get(`/api/v1/players/contact-change-review/${reviewToken}`)
        .expect(200);
      expect(preview.text).toContain(screenName);
      expect(preview.text).toContain('decision=approve');
      expect(preview.text).toContain('decision=stop');

      const info = await readInfo(playerId);
      expect(info.contactChangeReviewCode).toBe(reviewToken);
      expect(info.pendingParentContact).not.toBeNull();

      const bogus = await request(app.getHttpServer())
        .get(`/api/v1/players/contact-change-review/${'0'.repeat(64)}`)
        .expect(200);
      expect(bogus.text).toContain('Länken fungerar inte längre');
    });

    it('approve AFTER the new address confirmed applies the change immediately', async () => {
      const parent = 'ccp-approve-after-parent@example.com';
      const newContact = 'ccp-approve-after-new@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);

      await requestChange(sessionToken, newContact);
      const reviewToken = reviewTokenMailedTo(parent);
      await confirmChange(playerId, sessionToken);
      expect(await getProfileContact(sessionToken)).toBe(parent);

      const approve = await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=approve`,
        )
        .expect(200);
      expect(approve.text).toContain('Godkänt');

      expect(await getProfileContact(sessionToken)).toBe(newContact);
      const info = await readInfo(playerId);
      expect(info.pendingParentContact).toBeNull();
      expect(info.contactChangeApplyAt).toBeNull();
      expect(info.contactChangeReviewCode).toBeNull();

      // The parent approved it, so a reminder is now legitimate and goes
      // to the new, parent-approved address.
      sendMailSpy.mockClear();
      await request(app.getHttpServer())
        .post(`/api/v1/players/${playerId}/consent-reminder`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);
      expect(
        mailsTo(newContact).some((m) => m.text.includes('/api/v1/consent/')),
      ).toBe(true);
    });

    it('approve BEFORE the new address confirmed is held, then applies the moment it confirms (no grace)', async () => {
      const parent = 'ccp-approve-before-parent@example.com';
      const newContact = 'ccp-approve-before-new@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);

      await requestChange(sessionToken, newContact);
      const reviewToken = reviewTokenMailedTo(parent);

      await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=approve`,
        )
        .expect(200);
      // Not applied yet: the new address has not proven it exists.
      expect(await getProfileContact(sessionToken)).toBe(parent);

      const confirmed = await confirmChange(playerId, sessionToken);
      expect(confirmed.applied).toBe(true);
      expect(new Date(confirmed.appliesAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
      expect(await getProfileContact(sessionToken)).toBe(newContact);
    });

    it('stop BEFORE the new address confirmed kills the code, so confirming afterwards fails', async () => {
      const parent = 'ccp-stop-before-parent@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);

      await requestChange(sessionToken, 'ccp-stop-before-new@example.com');
      const reviewToken = reviewTokenMailedTo(parent);
      const code = (await readInfo(playerId)).contactChangeCode;

      await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=stop`,
        )
        .expect(200);

      // Session was evicted by the stop; the code is gone regardless.
      const info = await readInfo(playerId);
      expect(info.contactChangeCode).toBeNull();
      expect(info.pendingParentContact).toBeNull();
      expect(code).not.toBeNull();
    });

    it('an expired token is refused and changes nothing', async () => {
      const parent = 'ccp-expired-parent@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);
      await requestChange(sessionToken, 'ccp-expired-new@example.com');
      const reviewToken = reviewTokenMailedTo(parent);
      await confirmChange(playerId, sessionToken);

      await dataSource
        .getRepository(PlayerPrivateInfo)
        .update(
          { playerId },
          { contactChangeReviewCodeExpiresAt: new Date(Date.now() - 1000) },
        );

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=approve`,
        )
        .expect(200);
      expect(response.text).toContain('Länken fungerar inte längre');
      expect(await getProfileContact(sessionToken)).toBe(parent);
      expect((await readInfo(playerId)).pendingParentContact).not.toBeNull();
    });

    it('an unknown decision value is a 400 and changes nothing', async () => {
      const parent = 'ccp-baddecision-parent@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);
      await requestChange(sessionToken, 'ccp-baddecision-new@example.com');
      const reviewToken = reviewTokenMailedTo(parent);

      await request(app.getHttpServer())
        .post(
          `/api/v1/players/contact-change-review/${reviewToken}?decision=maybe`,
        )
        .expect(400);
      expect((await readInfo(playerId)).contactChangeReviewCode).toBe(
        reviewToken,
      );
    });
  });

  describe('already-approved accounts keep the original ADR-0012 flow', () => {
    it('gets no approve/stop link at request time, and a cancel link at confirm time', async () => {
      const parent = 'ccp-approved-parent@example.com';
      const { playerId, sessionToken } = await createPlayer(parent);
      const consentToken = (await readPlayer(playerId)).consentToken;
      await request(app.getHttpServer())
        .post(`/api/v1/consent/${consentToken}`)
        .expect(200);
      expect((await readPlayer(playerId)).parentalConsentStatus).toBe(
        ParentalConsentStatus.APPROVED,
      );

      sendMailSpy.mockClear();
      await requestChange(sessionToken, 'ccp-approved-new@example.com');
      expect((await readInfo(playerId)).contactChangeReviewCode).toBeNull();
      for (const mail of mailsTo(parent)) {
        expect(mail.text).not.toContain('contact-change-review');
      }

      const confirmed = await confirmChange(playerId, sessionToken);
      expect(confirmed.applied).toBe(false);
      const info = await readInfo(playerId);
      expect(info.contactChangeCancelCode).not.toBeNull();
      expect(
        mailsTo(parent).some((m) =>
          m.text.includes(
            `/api/v1/players/contact-change-cancel/${info.contactChangeCancelCode}`,
          ),
        ),
      ).toBe(true);
      expect(await getProfileContact(sessionToken)).toBe(parent);
    });
  });
});
