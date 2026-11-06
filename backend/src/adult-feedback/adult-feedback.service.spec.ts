import {
  AdultFeedbackAdultsOnlyException,
  AdultFeedbackNotDeliveredException,
  AdultFeedbackRateLimitedException,
} from '../common/errors/exceptions';
import { AdultFeedbackService } from './adult-feedback.service';
import { AdultFeedbackKind } from './adult-feedback.enum';

const PLAYER_ID = '11111111-1111-4111-8111-111111111111';
const THIS_YEAR = new Date().getUTCFullYear();

function build(opts: { age?: number; cap?: boolean; handedOff?: boolean } = {}) {
  const playerRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: PLAYER_ID,
      birthYear: THIS_YEAR - (opts.age ?? 40),
    }),
  };
  const redisService = {
    tryClaimAdultFeedbackDailyCap: jest.fn().mockResolvedValue(opts.cap ?? true),
  };
  const mailService = {
    sendMail: jest
      .fn()
      .mockResolvedValue({ handedOff: opts.handedOff ?? true, rejected: [] }),
  };
  const service = new AdultFeedbackService(
    playerRepository as never,
    redisService as never,
    mailService as never,
  );
  return { service, redisService, mailService };
}

const dto = { kind: AdultFeedbackKind.IDEA, text: 'Fler övningar tack' };

describe('AdultFeedbackService.submit', () => {
  it('mails the text to hello@skillstreak.xyz for an adult', async () => {
    const { service, mailService } = build();
    await expect(service.submit(PLAYER_ID, dto)).resolves.toEqual({
      sent: true,
    });
    const [mail] = mailService.sendMail.mock.calls[0] as [
      { to: string; text: string },
    ];
    expect(mail.to).toBe('hello@skillstreak.xyz');
    expect(mail.text).toContain('Fler övningar tack');
  });

  it('puts nothing identifying the sender in the mail', async () => {
    const { service, mailService } = build();
    await service.submit(PLAYER_ID, dto);
    expect(JSON.stringify(mailService.sendMail.mock.calls[0])).not.toContain(
      PLAYER_ID,
    );
  });

  it.each([5, 13, 17, 18])(
    'rejects a %i-year-old (by birth year) before rate limit or mail',
    async (age) => {
      const { service, mailService, redisService } = build({ age });
      await expect(service.submit(PLAYER_ID, dto)).rejects.toBeInstanceOf(
        AdultFeedbackAdultsOnlyException,
      );
      expect(redisService.tryClaimAdultFeedbackDailyCap).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    },
  );

  it('accepts a birth-year difference of 19 (certainly 18+)', async () => {
    const { service } = build({ age: 19 });
    await expect(service.submit(PLAYER_ID, dto)).resolves.toEqual({
      sent: true,
    });
  });

  it('refuses without mailing when the daily cap is spent', async () => {
    const { service, mailService } = build({ cap: false });
    await expect(service.submit(PLAYER_ID, dto)).rejects.toBeInstanceOf(
      AdultFeedbackRateLimitedException,
    );
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('reports failure when the mail was not handed off', async () => {
    const { service } = build({ handedOff: false });
    await expect(service.submit(PLAYER_ID, dto)).rejects.toBeInstanceOf(
      AdultFeedbackNotDeliveredException,
    );
  });
});
