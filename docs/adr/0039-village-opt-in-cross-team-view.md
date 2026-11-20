# ADR-0039 — Skillstreak Village: an opt-in, k-anonymous view across team bubbles

## Status

Accepted, 2026-11-20. Building I-004 ("OS-byn" / Skillstreak Village) was
approved by the project owner on 2026-11-20. Design source: Hermes' spec
`mockups/I-004/README.md` (v3).

## Context

CLAUDE.md: *"a user only ever sees their own verified team"*, with one
existing exception (a player's own clips under their own parent's consent,
ADR-0030). Village shows a team its own arena next to other teams' arenas,
grouped by sport — so it is a second, deliberate exception, and this ADR is
where its edges are written down. Anything not listed under "what crosses"
does not cross.

## Decision

**1. What crosses the bubble — exactly three things, nothing else.**

- Another opted-in team's **display name**, masked: shown as typed only if
  it is built entirely from the fixed name-builder vocabulary
  (`backend/src/village/village-team-name.util.ts`, e.g. "Snabba
  Falkarna"); anything else is replaced by a neutral sport name
  ("Klubbhjältarna"). The check runs on the server, on the name itself —
  never on a client-supplied "came from the builder" flag.
- That team's **sport** (`team.sport`, one per team, default `FLOORBALL`).
- One **coarse activity level per sport** (`CALM`/`SOME`/`MANY`/
  `VERY_MANY`): how many other opted-in teams in that sport logged any
  training in the last 3 hours, bucketed (0 / 1–2 / 3–5 / 6+). Never a
  per-team value, never a time, never a ranking.

**2. What never crosses.** Team ids (each name gets a one-off slot `s1…`,
in a fresh random order per response), player counts, children's real
names or screen names, avatars, photos, clips, chat, training logs or
times, points, locations, profiles. Names are plain text with no link to
anything.

**3. Off by default.** `team.village_opt_in` defaults to `false`. A team
that has not opted in is not listed, does not count toward the threshold
or the activity level, and — reciprocally — its own players see no other
team's name either (they still see the sport cards and coarse levels).

**4. Who can opt in.** The team's captain, through the same
`PlayersService.assertIsCaptainOfTeam` check every other team setting uses
(invite-code rotation, weekly goals, PT links), which also requires the
captain's own parental consent to be approved. The endpoint only ever acts
on the caller's own team. The app asks the captain to talk to the coach and
the parents first and confirms before turning it on; it can be turned off
at any time and takes effect on the next request (the app keeps no cached
copy of other teams' names).

**5. k-anonymity floor: 10.** A sport lists no names, and its level stays
`CALM`, until at least 10 *other* opted-in, non-test teams share it. At
most 25 names are listed per sport. Test teams (`is_test`) never appear.

**6. Who can read it.** Authenticated players whose team join is approved
(`assertTeamMembership`) — the same gate as every team-scoped read.

## Consequences

- Until a sport has 10 opted-in teams, Village shows only the team's own
  arena and empty, calm sport cards. That is intended.
- Without a name builder in onboarding, most existing team names are
  free text and will show masked. Bringing in Hermes' `TeamNameBuilder`
  is a separate change.
- `team.sport` has no UI yet; every team is floorball until one is added.
- **Not built, still owed by the spec**: informing parents when a team
  joins (Hermes' spec: "parents informed"), and a staff "hide this name"
  status. Both should land before Village is promoted beyond beta.
