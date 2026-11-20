# ADR-0040 — Skillstreak Village: an opt-in, k-anonymous view across team bubbles

## Status

Code accepted, 2026-11-20; **switched off until the gate below is passed.**
The project owner approved building I-004 ("OS-byn" / Skillstreak
Village) on 2026-11-20. Design source: Hermes' spec
`mockups/I-004/README.md` (v3).

### Gate before enabling

Three things must be done before either switch is turned on, in any
environment (the beta is the live app):

1. **The CLAUDE.md amendment** below — the project owner's own action.
2. **Parents informed when their team joins** (Hermes' spec), through the
   existing parental email flow. Without it a child captain's single tap
   is the only step between a team and the village.
3. **Distinct-parent check for k** — a member counts toward a team's
   qualification only if their parent email is not also behind a member of
   another qualifying team. Without it, someone controlling 45 parent
   addresses can, after 14 days, still pad a sport to k (Decision 5).

Village crosses the closed team bubble, and CLAUDE.md names exactly one
exception to it today (ADR-0030, a player's own clips). ADR-0029
Decision 1 says that crossing its moves 1 or 4 "requires the project
owner's CLAUDE.md amendment plus a new ADR". This is the new ADR. **The
amendment is still owed, and only the project owner can make it.** Until
then both switches stay off: the API's `VILLAGE_ENABLED` (k8s ConfigMap,
only `"true"` turns it on; otherwise both endpoints 404) and the app's
`EXPO_PUBLIC_VILLAGE_ENABLED` (only `true` shows the entry point).

Suggested wording for the owner to accept, reject or edit:

> **Except for Skillstreak Village (ADR-0040)**: a team whose captain has
> opted it in may show other opted-in teams exactly three things — its
> team name (masked to a fixed name-builder vocabulary), its sport, and a
> coarse per-sport activity level aggregated over at least ten teams.
> Nothing a child wrote, recorded or earned beyond that crosses.

## Context

Village shows a team its own arena next to other teams' arenas, grouped by
sport. It is a second, deliberate exception to "a user only ever sees their
own verified team", and this ADR is where its edges are written down.
Anything not listed under "what crosses" does not cross.

### Reconciling with ADR-0029 Decision 1

ADR-0029's rule: a cross-team surface may carry facts about teams, never
"anything a child authored, recorded, typed, earned", and never make teams
browsable by adults. Village crosses two of its five moves, knowingly:

- **Move 1 (child-created artifact).** A team name is typed by a child,
  and the activity level is derived from training logs. Mitigation: the
  name is shown only if it consists solely of fixed-vocabulary words
  (otherwise a neutral name replaces it, Decision 1), and the level is a
  4-step bucket over at least ten qualifying teams, computed per quarter
  hour (Decisions 1 and 5). No individual log, time or count crosses.
- **Move 4 (browsable list of teams).** Village lists teams to players of
  other teams. Mitigation: only teams that opted in, only to teams that
  also opted in (reciprocal), at most ten names per sport, no id, no link,
  no contact path, and no way to reach a team from its name.

ADR-0029 is otherwise unchanged; kudos and the drill library stay as it
decided.

## Decision

**1. What crosses the bubble — exactly three things.**

- Another qualifying team's **display name**, masked: shown only if it is
  built entirely from the fixed name-builder vocabulary
  (`backend/src/village/village-team-name.util.ts`, e.g. "Snabba
  Falkarna"), and then rebuilt from the matched words so casing and
  whitespace carry nothing; anything else becomes a neutral sport name
  ("Klubbhjältarna"). Decided on the server from the name itself, never
  from a client-supplied flag.
- That team's **sport** (`team.sport`, one per team, default `FLOORBALL`).
- One **coarse activity level per sport** (`CALM`/`SOME`/`MANY`/
  `VERY_MANY`): how many other qualifying teams in that sport logged any
  training in the 3 hours before the current quarter-hour bucket,
  bucketed 0 / 1–2 / 3–5 / 6+. Never per team, never a time, never a
  ranking.

**2. What never crosses.** Team ids, player counts, team counts,
children's names or screen names, avatars, photos, clips, chat, training
logs or times, points, locations, profiles. Names are plain text with no
link to anything.

**3. Off by default, and reciprocal.** `team.village_opt_in` defaults to
`false`. A team that has not opted in is not listed and does not count
toward the threshold or the level — and its own players get neither names
nor levels (every sport card is CALM and empty).

**4. Who can opt in.** The team's captain, through the same
`PlayersService.assertIsCaptainOfTeam` check every other team setting
uses, which also requires the captain's own parental consent to be
approved. The endpoint acts only on the caller's own team. The app tells
the captain to talk to the coach and the parents first and confirms
before turning it on. The last change is recorded: who (captain's player
id, FK `ON DELETE SET NULL` so account erasure clears it) and when
(`village_opt_in_changed_at` / `_by`). Only the latest change is kept; a
full history would need an append-only table.

**5. k-anonymity, hardened against padding.** A sport lists no names, and
its level stays CALM, until at least **10 other qualifying teams** share
it. A team qualifies only if it is opted in, not a test team, at least
**14 days old**, and has at least **5 members whose team join and
parental consent are both approved** — so defeating k with throwaway
teams costs 45 consented accounts and two weeks rather than nine sign-ups.
The viewer's own team must qualify by the same rule before it sees
anything (symmetric reciprocity).
Once k is met, exactly **10** names are shown, so the list length says
nothing about the team count. The sample, its order and the level are
fixed for each quarter-hour bucket, so polling learns nothing finer.

**6. Who can read it.** Authenticated players whose team join is approved
(`assertTeamMembership`), 12 requests/min.

## Consequences

- Until a sport has 10 qualifying teams, Village shows only the team's own
  arena and empty, calm sport cards. That is intended.
- Without a name builder in onboarding, most existing team names are free
  text and will show masked. Hermes' `TeamNameBuilder` is a separate
  change.
- `team.sport` has no UI yet; every team is floorball until one is added.
- **Still owed**: the three items under "Gate before enabling", and a
  staff "hide this name" status.
