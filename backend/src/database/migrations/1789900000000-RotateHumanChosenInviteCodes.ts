import { MigrationInterface, QueryRunner } from 'typeorm';
import { generateTeamInviteCode } from '../../teams/team-invite-code.util';

/**
 * ADR-0009's 2026-11-08 amendment — replaces every team invite code that
 * predates server-side generation.
 *
 * **"Weak" here means "chosen by a person", and that is every existing
 * row.** Until this release the team's creator typed the code, and
 * nothing before it ever generated one, so there is no row this migration
 * could safely keep. Format alone cannot tell them apart: a club name
 * plus a year (`FALKEN24`) is eight characters from the generator's own
 * alphabet and is exactly the guessable kind this exists to remove. So
 * the rule is provenance, not shape — and provenance is "all of them".
 *
 * Consequence the owner signed off on: every printed, posted or shared
 * code stops working the moment this runs. Players already on a team are
 * unaffected (membership is `team_id`, never the code). Captains see the
 * new code where they always did — Laget tab, `GET /teams/:id/dashboard`
 * — and can rotate it again from there.
 *
 * Codes are generated in TypeScript with the same generator the API uses,
 * rather than in SQL, so there is exactly one definition of what a team
 * code looks like. Uniqueness is guaranteed by refusing any code already
 * issued in this run or still held by a not-yet-updated row.
 *
 * The moderation re-roll that `TeamsService` applies is not repeated
 * here — it needs the DI-provided filter. A random code that happens to
 * spell something is rare, and the captain can rotate it.
 */
export class RotateHumanChosenInviteCodes1789900000000 implements MigrationInterface {
  name = 'RotateHumanChosenInviteCodes1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const teams = (await queryRunner.query(
      `SELECT "id", "invite_code" FROM "team" ORDER BY "created_at"`,
    )) as Array<{ id: string; invite_code: string }>;
    // Seeded with the old codes too: a new code equal to a not-yet-updated
    // team's old one would trip the unique constraint mid-run.
    const issued = new Set<string>(teams.map((team) => team.invite_code));
    for (const team of teams) {
      let code = generateTeamInviteCode();
      while (issued.has(code)) {
        code = generateTeamInviteCode();
      }
      issued.add(code);
      await queryRunner.query(
        `UPDATE "team" SET "invite_code" = $1 WHERE "id" = $2`,
        [code, team.id],
      );
    }
  }

  public async down(): Promise<void> {
    // Irreversible by design: the human-chosen codes are discarded, not
    // stored, and restoring guessable codes is the one thing nobody
    // should be able to do with a rollback. A revert leaves the generated
    // codes in place, which every version of the app accepts.
  }
}
