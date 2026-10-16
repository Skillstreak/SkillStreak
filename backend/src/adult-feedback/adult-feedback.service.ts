import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdultFeedbackAdultsOnlyException,
  AdultFeedbackNotDeliveredException,
  AdultFeedbackRateLimitedException,
  PlayerNotFoundException,
} from '../common/errors/exceptions';
import { MailService } from '../mail/mail.service';
import { renderAdultFeedbackEmail } from '../mail/templates/adult-feedback-email.template';
import { Player } from '../players/entities/player.entity';
import { RedisService } from '../redis/redis.service';
import {
  ADULT_FEEDBACK_MIN_YEAR_DIFFERENCE,
  ADULT_FEEDBACK_RECIPIENT,
} from './adult-feedback.constants';
import { CreateAdultFeedbackDto } from './dto/create-adult-feedback.dto';

/**
 * I-001 — adult (18+) free-text feedback, forwarded by mail and stored
 * nowhere.
 *
 * **Child safety is enforced here, on the server, before anything else.**
 * The age check is the first thing that happens: an under-18 account
 * gets a 403 and its text is never stored, mailed, rate-counted or
 * logged (this class has no logger on purpose). The mobile app hides the
 * card for children too, but that is a convenience, not the gate.
 *
 * Nothing about the sender is put in the mail — no screen name, player
 * id, team or age.
 */
@Injectable()
export class AdultFeedbackService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
  ) {}

  async submit(
    playerId: string,
    dto: CreateAdultFeedbackDto,
  ): Promise<{ sent: true }> {
    const player = await this.playerRepository.findOne({
      where: { id: playerId },
      select: { id: true, birthYear: true },
    });
    if (!player) {
      throw new PlayerNotFoundException();
    }
    const yearDifference = new Date().getUTCFullYear() - player.birthYear;
    if (yearDifference < ADULT_FEEDBACK_MIN_YEAR_DIFFERENCE) {
      throw new AdultFeedbackAdultsOnlyException();
    }

    if (!(await this.redisService.tryClaimAdultFeedbackDailyCap(playerId))) {
      throw new AdultFeedbackRateLimitedException();
    }

    const rendered = renderAdultFeedbackEmail({
      kind: dto.kind,
      text: dto.text,
    });
    const result = await this.mailService.sendMail({
      to: ADULT_FEEDBACK_RECIPIENT,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    // Nothing is stored, so a failed handoff means the text is lost —
    // say so rather than thanking the sender for a message nobody got.
    if (!result.handedOff) {
      throw new AdultFeedbackNotDeliveredException();
    }
    return { sent: true };
  }
}
