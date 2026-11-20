import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentPlayerId } from '../auth/current-player-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { PlayersService } from '../players/players.service';
import { SetVillageOptInDto } from './dto/set-village-opt-in.dto';
import { VillageService } from './village.service';
import type { VillageView } from './village.types';

/**
 * Skillstreak Village (I-004) — ADR-0039. The one deliberate, opt-in
 * exception to "a user only ever sees their own verified team"; read the
 * ADR before widening anything here.
 */
@Controller('api/v1/village')
export class VillageController {
  constructor(
    private readonly villageService: VillageService,
    private readonly playersService: PlayersService,
  ) {}

  /**
   * Team-scoped read: assertTeamMembership refuses a pending or rejected
   * joiner, the same gate as every other read of team data.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Get()
  async getVillage(@CurrentPlayerId() playerId: string): Promise<VillageView> {
    const me = await this.playersService.findByIdOrThrow(playerId);
    const player = await this.playersService.assertTeamMembership(
      playerId,
      me.teamId,
    );
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
    const me = await this.playersService.findByIdOrThrow(playerId);
    await this.playersService.assertIsCaptainOfTeam(playerId, me.teamId);
    await this.villageService.setOptIn(me.teamId, body.optedIn);
    return { optedIn: body.optedIn };
  }
}
