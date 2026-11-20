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
   **DONE (2026-11-20).** Made by the coordinating session on the owner's
   direct instruction in chat, using the wording below.
2. **Parents informed when their team joins** — **DONE (2026-11-20).**
   Decision 7.
3. **Anti-padding: distinct parents + at most 5 teams per parent** —
   **DONE (2026-11-20).** Decisions 5 and 8. The owner's rule replaced the
   earlier "parent not behind any other qualifying team" idea, since a
   parent may genuinely have children in several teams.

Village crosses the closed team bubble, and CLAUDE.md names exactly one
exception to it today (ADR-0030, a player's own clips). ADR-0029
Decision 1 says that crossing its moves 1 or 4 "requires the project
owner's CLAUDE.md amendment plus a new ADR". This is the new ADR. The
amendment landed 2026-11-20 with this ADR. Both switches still ship off
and are turned on deliberately: the API's `VILLAGE_ENABLED` (k8s ConfigMap,
only `"true"` turns it on; otherwise both endpoints 404) and the app's
`EXPO_PUBLIC_VILLAGE_ENABLED` (only `true` shows the entry point).

Wording as adopted in CLAUDE.md:

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
**14 days old**, and has at least **5 members with distinct parent
contacts** (compared by blind index, Decision 8) **whose team join and
parental consent are both approved** — so defeating k with throwaway
teams costs 45 consented accounts and two weeks rather than nine sign-ups.
The viewer's own team must qualify by the same rule before it sees
anything (symmetric reciprocity).
Once k is met, exactly **10** names are shown, so the list length says
nothing about the team count. The sample, its order and the level are
fixed for each quarter-hour bucket, so polling learns nothing finer.

**6. Who can read it.** Authenticated players whose team join is approved
(`assertTeamMembership`), 12 requests/min.

**7. Parents are told when their team joins.** When the captain turns
opt-in ON, the parent contact of every member whose team join AND
parental consent are approved gets one informational mail
(`mail/templates/village-joined-email.template.ts`, in the child's locale,
Swedish fallback): the team joined, exactly what other teams see (the
name as shown — masked if free text —, the sport, the coarse level), what
they never see, and how to get it turned off (captain/coach, or
hello@skillstreak.xyz). Only consent-approved members, so every address
mailed has been proven by its owner. Self-verified accounts (13+, whose
contact is the child's own address) are skipped. One mail per distinct
address (by the same normalisation as Decision 8), read through the same
path as every other contact read, so a contact change already past its
grace period is applied first and the replaced address is never mailed;
phone-only contacts
cannot be mailed and are skipped. Not sent on OFF, and not again if
turned ON within 30 days (`team.village_join_notice_sent_at`, claimed
under a row lock). Best-effort: the toggle never waits on or fails because
of mail; if no mail at all is handed off, the claim is released so the
next ON retries. Counts are logged, addresses never.

**8. One parent contact, at most 5 teams** (owner's rule, 2026-11-20). A
parent contact may be the parent of members whose team join AND parental
consent are both approved in at most 5 distinct teams. Only verified
memberships count: counting unverified ones let anyone lock any address
out by creating five teams with it (security review, 2026-11-20). It is
enforced where a membership starts to count, each time inside that
transaction under a transaction-scoped advisory lock keyed by the blind
index (so concurrent approvals cannot both pass at 4):

- **parental consent approval** — the parent who clicks sees a "could not
  approve" page; the approval is rolled back and the link stays usable;
- **the captain's join approval** — the captain sees a generic "couldn't
  approve, ask the coach" (nothing about another family);
- **a contact-change request** for an approved member.

It is deliberately *not* checked at onboarding: nothing is verified there,
and an unauthenticated check would let anyone probe whether an address is
at the cap. Error `parent_team_cap_reached` (409). Existing data over the
cap is grandfathered, not removed.

Comparison uses `player_private_info.parent_contact_index`: an HMAC-SHA256
of the normalised contact under a key derived from `PII_ENCRYPTION_KEY`
with a fixed label. Normalisation merges aggressively so one inbox cannot
pass for several parents: email lower-cased, "+tag" dropped, Gmail dots
dropped and googlemail.com folded into gmail.com; phone reduced to "+"
and digits with a leading "00" read as "+". `parent_contact` itself stays
AES-GCM with a random IV and is never compared or logged. The index is
backfilled by the migration (which refuses to finish if no row decrypts —
a wrong key would otherwise silently switch the cap off) and kept in step
on every write of `parent_contact`. A rotation of `PII_ENCRYPTION_KEY`
must recompute it.

The index is a new disclosure compared with random-IV ciphertext: someone
with a database dump, even without the key, can see which children share
a parent contact (siblings). Accepted as the cost of the comparison.

## Consequences

- Until a sport has 10 qualifying teams, Village shows only the team's own
  arena and empty, calm sport cards. That is intended.
- Without a name builder in onboarding, most existing team names are free
  text and will show masked. Hermes' `TeamNameBuilder` is a separate
  change.
- `team.sport` has no UI yet; every team is floorball until one is added.
- **Still owed**: a staff "hide this name" status.
- **Known gaps, not closed in this change** (security review 2026-11-20):
  - The cap is checked when a contact change is *requested*, not when it
    is applied after its grace period; concurrent requests, or a change on
    a still-pending member, can land an address over the cap.
  - Parents of children who join (or get consent approved) *after* the
    team turned Village on are not sent the notice.
  - A national phone number ("070…") is not folded into its "+46…" form.
- The cap and the distinct-parent rule raise the cost of padding a sport
  to k (≥ 9 distinct verified parent addresses, 45 consented accounts, 14
  days); they do not make it impossible.

## Amendment 2026-11-20 — owner preview

The project owner asked to see Village on their own account before it is
switched on for anyone. `VILLAGE_PREVIEW_PLAYER_IDS` (ConfigMap) lists
player ids that, while `VILLAGE_ENABLED` is not `"true"`, get:

- `GET /village/access` → `{ enabled: true, preview: true }`, which shows
  the entry in any app build (the build flag is no longer required);
- `GET /village` → their own team's arena as stored, plus arenas that are
  **made up in code** (`village-preview.ts`, name-builder vocabulary, no
  database read). No other team's name, sport or activity is read, so
  nothing crosses a bubble; the response carries `preview: true` and the
  app labels it;
- `PUT /village/opt-in` → 404, and `canManage` is always false: a preview
  viewer cannot join for real, so no parent notice goes out and nothing
  changes for when Village opens.

Once `VILLAGE_ENABLED` is `"true"` the list is ignored and everyone,
listed or not, gets the real view.
