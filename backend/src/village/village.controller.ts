import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CurrentPlayerId } from '../auth/current-player-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { PlayersService } from '../players/players.service';
import { SetVillageOptInDto } from './dto/set-village-opt-in.dto';
import { VillageJoinNoticeService } from './village-join-notice.service';
import { VillageService } from './village.service';
import type { VillageAccess, VillageView } from './village.types';

type VillageMode = 'on' | 'preview' | 'off';

/**
 * Skillstreak Village (I-004) — ADR-0040. The one deliberate, opt-in
 * exception to "a user only ever sees their own verified team"; read the
 * ADR before widening anything here.
 */
@Controller('api/v1/village')
export class VillageController {
  private readonly logger = new Logger(VillageController.name);

  constructor(
    private readonly villageService: VillageService,
    private readonly playersService: PlayersService,
    private readonly configService: ConfigService,
    private readonly joinNotice: VillageJoinNoticeService,
  ) {}

  /**
   * Server-side off switch (VILLAGE_ENABLED, only 'true' turns it on), so
   * turning Village off does not depend on which app build is installed.
   * While it is off, players listed in VILLAGE_PREVIEW_PLAYER_IDS get the
   * made-up preview instead (owner decision 2026-11-20).
   */
  private modeFor(playerId: string): VillageMode {
    if (this.configService.get<string>('VILLAGE_ENABLED') === 'true') {
      return 'on';
    }
    const preview = (
      this.configService.get<string>('VILLAGE_PREVIEW_PLAYER_IDS') ?? ''
    )
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    return preview.includes(playerId) ? 'preview' : 'off';
  }

  /**
   * Whether the app should show the village entry for this player. Never
   * 404s, so the app can ask before it knows; says nothing about any team.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Get('access')
  getAccess(@CurrentPlayerId() playerId: string): VillageAccess {
    const mode = this.modeFor(playerId);
    return { enabled: mode !== 'off', preview: mode === 'preview' };
  }

  /**
   * Team-scoped read: assertTeamMembership refuses a pending or rejected
   * joiner, the same gate as every other read of team data.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Get()
  async getVillage(@CurrentPlayerId() playerId: string): Promise<VillageView> {
    const mode = this.modeFor(playerId);
    if (mode === 'off') throw new NotFoundException();
    const me = await this.playersService.findByIdOrThrow(playerId);
    const player = await this.playersService.assertTeamMembership(
      playerId,
      me.teamId,
    );
    if (mode === 'preview') {
      return this.villageService.getPreviewView(player.teamId);
    }
    return this.villageService.getVillageView({
      teamId: player.teamId,
      canManage:
        player.isCaptain &&
        player.parentalConsentStatus === ParentalConsentStatus.APPROVED,
    });
  }

  /**
   * Turns the caller's own team in or out of the village. Captain-only via
   * assertIsCaptainOfTeam — the same check as every other team setting
   * (invite-code rotation, weekly goals, PT links), which also requires
   * the captain's own parental consent to be approved. The team is always
   * the caller's own; there is no teamId parameter to point elsewhere.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Put('opt-in')
  @HttpCode(HttpStatus.OK)
  async setOptIn(
    @CurrentPlayerId() playerId: string,
    @Body() body: SetVillageOptInDto,
  ): Promise<{ optedIn: boolean }> {
    // Only when really on: a preview viewer must not join for real, which
    // would mail parents about a village nobody can see yet.
    if (this.modeFor(playerId) !== 'on') throw new NotFoundException();
    const me = await this.playersService.findByIdOrThrow(playerId);
    await this.playersService.assertIsCaptainOfTeam(playerId, me.teamId);
    await this.villageService.setOptIn(me.teamId, body.optedIn, playerId);
    // ADR-0040 — parents are told when the team joins (ON only, at most
    // once per 30 days). Not awaited: a mail problem must never block or
    // fail the toggle; failures are logged by count inside.
    if (body.optedIn) {
      this.joinNotice.notifyIfDue(me.teamId).catch(() => {
        this.logger.warn('Village join notice failed for a team.');
      });
    }
    return { optedIn: body.optedIn };
  }
}
