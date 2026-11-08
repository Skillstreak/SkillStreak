import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InviteCodeNotFoundException } from '../common/errors/exceptions';
import { TeamsService } from './teams.service';

interface TeamInvitePreviewResponse {
  teamId: string;
  teamName: string;
}

@Controller('api/v1/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // No auth — a device doesn't have a token yet at this point, per
  // docs/api/phase1-contract.md. 10/min/IP is enough for a coach's whole
  // practice session of kids previewing their team once each.
  //
  // Until 2026-11-08 the code was whatever the team's creator typed
  // (`IBK2014`), so this route was a guess-confirmation oracle and the
  // throttle was the only thing in the way. Codes are now server-generated
  // at 40 bits (ADR-0009's 2026-11-08 amendment), which this throttle puts
  // far out of enumeration range; it stays because it costs nothing.
  //
  // Still answers with the team's name. That is deliberate and not cheap
  // to remove: Screen O2 ("is this your team?") exists so a child who
  // mistyped a code into a *real* team notices before asking to join it,
  // and every installed build depends on the name being here. With an
  // unguessable code, the name is only ever shown to someone who already
  // holds the code — i.e. someone the team gave it to.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('invite/:inviteCode')
  async previewByInviteCode(
    @Param('inviteCode') inviteCode: string,
  ): Promise<TeamInvitePreviewResponse> {
    const team = await this.teamsService.findByInviteCode(inviteCode);
    if (!team) {
      throw new InviteCodeNotFoundException();
    }
    return { teamId: team.id, teamName: team.name };
  }
}
