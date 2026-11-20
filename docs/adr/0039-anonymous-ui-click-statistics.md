# ADR-0039 — Anonymous UI click statistics (I-003)

## Status

Proposed, 2026-11-06. For the project owner to accept or amend.

I-003 was founder-approved 2026-10-16 (default off, decided 2026-10-19)
and built as PR #142 (backend) and PR #143 (mobile). The security review
of both on 2026-11-06 held them, partly because no ADR covered them:
ADR-0020 Decision 1 rejected client-side instrumentation in the app, and
its Decision 7 ("no new consent gate or copy") is explicitly conditional
on that. The owner chose to proceed with an ADR rather than drop I-003.

**Amends ADR-0020** for one narrow shape (Decision 1 below). It does not
supersede it: ADR-0020's server-side metrics, and its rejection of a
general event pipeline, stand. A dated note in ADR-0020 points here.

## Context

What the two PRs build: the app counts how often a fixed set of screens
and buttons is used, holds the counts in memory, and every 4–6 minutes
(or on backgrounding) posts `[{key, count}]` to an unauthenticated
`POST /api/v1/ui-metrics/counts`. The server adds them into
`ui_click_count(key, day, count, senders)` — no player, device, team, IP
or timestamp column. An admin-only view reads it; a nightly sweep deletes
rows after 90 days.

The stored table is genuinely not about anyone. Four things around it
were not right, and they are what this ADR decides:

- the under-13 "parent's choice" is the arithmetic `ParentalGate`, which
  ADR-0034 Decision 3 says in as many words is not a security control;
- the opt-in is a per-device flag that survives logout, so one account's
  opt-in carries over to another account on the same phone;
- app and server use different key names (`screen.home` vs
  `screen_home`), so every upload is rejected with a 400 and dropped;
- the "k-anonymity floor of 10" counts uploads, not people.

## Decision 1 — Counters are not ADR-0020's option B, and that is the only door this opens

ADR-0020 rejected option B because its purpose was "a fine-grained,
timestamped, per-action trail per child". This feature is permitted
because it is structurally not that, and stays permitted only while all
of these hold:

- **Counts per key per day, nothing else.** No timestamps or time of day,
  no event order, no session, no per-upload record. The server keeps
  only the running sum.
- **No identifier in the request.** A bare `fetch` with no auth header,
  no player, team, device or install id, no user agent beyond what the
  platform sends by itself. The body accepts `key` and `count` only.
- **Fixed vocabulary** (Decision 4). A key names a screen or a button,
  never content: no clip id, team id, free text or dynamic segment.
- **App-wide output only.** The admin view takes no team or player
  parameter and none may be added.

Funnels ("opened X, then abandoned Y"), dwell time, per-team breakdowns
and any third-party SDK remain rejected as ADR-0020 rejected them. Any one
of them needs a new ADR, not an amendment to this one.

## Decision 2 — Legal basis: consent to collect from the device, and under 13 that means the parent, for real

**Not Art. 8 by virtue of what is stored.** The rows are not personal
data, so the stored output needs no legal basis of its own. That much of
the PR's reasoning is right.

**But collecting it is still consent-based.** Counting interactions on
the phone and sending them off it is reading information from the user's
terminal equipment for a purpose that is not strictly necessary for the
service. Under ePrivacy Art. 5(3) (in Sweden, the Electronic
Communications Act, LEK) that needs consent to the GDPR standard, and for
a child below the digital-consent age that consent is the parent's. The
request also carries the device's IP address in transit (Decision 6),
which is personal data whatever the table holds.

So the honest options were:

- **(A) Call the toggle a preference, gated by `ParentalGate`, and rely on
  "nothing identifying is stored".** Cheapest, and what the PR does. It
  builds something load-bearing on a gate this project has already said
  in writing is not one (ADR-0034 Decision 3), and the parent-facing text
  would claim "your parent chose this" when a ten-year-old who can
  multiply 27 × 7 chose it.
- **(B) Under 13, require the real parent-consent email flow**, the way
  ADR-0030 does sharing consent: a mail to the parent contact already on
  file, an approve page, revocable from the same mail.

**Decision: (B), delivered in two steps.**

1. **v1 ships for self-verified accounts only** (`isSelfVerification`
   true, the existing Art. 8 age band, plus adult accounts). They consent
   for themselves, through a neutral two-button confirm with equal
   weight. **Under-13 accounts do not see the toggle at all** and never
   send. The `ParentalGate` path in `AnonymousStatsCard` is removed, not
   kept as a fallback.
2. **Under-13 participation is a separate follow-up**, built only if the
   owner wants it: a new consent purpose on the existing parent-mail
   machinery (ADR-0030's pattern: separate consent, standing state,
   revocable, off instantly). Never folded into the account-creation
   consent already held; that is the reinterpretation ADR-0030 Decision 1
   rejected.

The cost is that v1 sees nothing from the youngest users, who are much
of the audience. That is accepted: these are advisory statistics
(Decision 5), and the alternative is a consent claim that is not true.

## Decision 3 — The opt-in belongs to an account, not a phone

- **Per account, off by default.** The flag is stored under a key that
  includes the account id (`skillstreak.anonymousStats.<accountId>`), so
  a sibling's or parent's opt-in can never apply to another account on
  the same device.
- **Cleared on logout and on account switch.** Logout deletes the
  current account's key and resets the in-memory client to off,
  discarding unsent counts (never flushing them). The client is
  re-initialised from the new account's own key after login.
- **Re-read on every app start against the logged-in account**; with no
  account logged in, the client is off.
- When the under-13 follow-up exists, those accounts' state lives
  server-side (it is a parent's consent record) and the app reads it from
  `/me`; it is never cached to a device key. Self-verified accounts may
  move to the same source then; not required for v1.

The flag is enforced only in the app, because the endpoint is anonymous
by design. That is stated in the code, as the PR already does.

## Decision 4 — One closed key list, owned by the server, with a blocking parity test

- **The server's `UiCounterKey` enum is the authority.** Form:
  `screen_<name>` and `btn_<name>`, snake_case. The app holds a literal
  copy, the house pattern elsewhere (`mobile/src/api/types.ts` lockstep
  comments).
- **v1 list**, reconciled from the two PRs, every key with a real call
  site: `screen_home`, `screen_shorts`, `screen_goal`, `screen_team`,
  `screen_chat`, `screen_tips`, `screen_profile`, `btn_log_training`,
  `btn_start_timer`, `btn_stop_timer`, `btn_record_clip`,
  `btn_share_clip`, `btn_open_clip`, `btn_chat_send`,
  `btn_invite_friend`. `button.cheer` (no feature) and `btn_open_tips`
  (duplicates `screen_tips`) are dropped. Developers may trim this; they
  may not add to it without the review below.
- **Parity test lives in the backend suite**, because `Backend lint,
  build, test` is a required check and the mobile checks are advisory.
  It reads the app's key file from the checkout and fails if the two sets
  differ in either direction.
- **Adding a key** is a PR that touches both lists and gets a
  security-reviewer pass. The check is narrow: the key names a screen or
  button, not content, and does not by itself reveal something about a
  child (a key per team, per badge or per clip would).

## Decision 5 — The floor: drop the k-anonymity claim, keep a cheap floor that closes the real hole

`senders` is the number of upload calls; one phone posts every few
minutes, so `senders >= 10` can be one child. Calling it k-anonymity is
false and comes out of code comments, the PR text and any copy.

The real re-identification path is differencing: an operator reading
today's live row twice, around a moment they know one specific child used
the app, sees exactly that child's upload. So:

- **The admin view returns finished days only** (`day < today`,
  Europe/Stockholm). A closed day's row never changes again, so there is
  nothing to diff.
- **Rows with `senders < 10` return neither `count` nor `senders`**, just
  `{key, day, suppressed: true}`. Returning `senders` on a suppressed row
  leaks the volume the floor exists to hide.
- The floor is described as what it is: "hides low-volume days", not a
  guarantee about people.

## Decision 6 — Counter integrity: bigint, and the numbers are advisory

- **`count` and `senders` are `bigint`.** The endpoint is unauthenticated;
  at the current per-call cap (20 keys × 1000) and 30 calls/min/IP, one
  client can push an `integer` key past 2^31 in a few days, after which
  every upsert of that key errors for the rest of the day. `bigint` costs
  nothing at this table's size and is simpler than a saturating upsert.
  The existing per-item 1..1000 bound and 20-key batch cap stay.
- **The route must be covered by `throttle-coverage.spec.ts`** with its
  own `@Throttle`, like the other open routes.
- **Stats are advisory and forgeable.** Anyone can inflate any counter.
  They never drive anything with consequences: no product gating, no
  rewards, nothing shown to players, coaches, parents or teams. The admin
  view says so.

## Decision 7 — IP addresses and disclosure

**IP, in one honest sentence**, used in the copy and the privacy policy:
*"Like every request to our server, the upload arrives from your device's
IP address; it is used for about a minute to stop abuse, appears in our
ordinary server logs, and is never stored with the counts."* The
throttler keys on a SHA-256 of the IP with a 60-second TTL (a hash of an
IPv4 address is trivially reversible, so the TTL is the protection, not
the hash); ingress access
logs are whatever the cluster keeps (see owner's calls below).

**Parent- and player-facing copy** (sv as source, other locales follow):
the card and confirm must say what is counted (how often screens and
buttons are used), what is not (who pressed, when, anything they wrote or
filmed), that it is off until switched on, that it can be switched off at
any time, and that **counts are kept for 90 days** and then deleted. Drop
"helt anonymt" and "inga personuppgifter" as absolute claims; the IP
sentence makes them untrue in transit.

**Elsewhere, same PR as the feature:**

- `docs/legal/privacy-policy-DRAFT.md`: a short section next to §8's
  site counters, with the IP sentence and the 90 days.
- `docs/STORE-DATA-SAFETY.md`: add *Usage Data — Product Interaction*,
  optional, **not linked**, purpose analytics, not tracking. Today both
  store forms say no usage data is collected; shipping this without the
  row makes them false.
- No change to Kids Category posture (ADR-0034): this is first-party,
  carries no identifier and adds no SDK.

## Consequences

- PR #142: `bigint` columns; finished-days-only admin query; suppressed
  rows drop `senders`; key enum per Decision 4; parity test; throttle
  coverage; "k-anonymity" removed from comments.
- PR #143: per-account key, cleared on logout and switch; under-13 toggle
  not rendered and the `ParentalGate` path removed; keys renamed to the
  server's list; copy rewritten per Decision 7.
- ADR-0020's Decision 7 conclusion does not extend to this feature; this
  ADR carries its own consent analysis (Decision 2).
- Security-reviewer re-review of both PRs against this ADR before either
  merges into `review`.
- Not built here: the under-13 parent-consent purpose (Decision 2 step 2).

## Owner's calls

1. **Accept Decision 2's v1 scope** (13+ and adults only), or decide the
   under-13 parent-consent follow-up is wanted now, which makes I-003 a
   materially bigger piece of work.
2. **Whether to get a legal read on Decision 2.** The ePrivacy reasoning
   is the conservative reading, not a lawyer's. If counsel says option
   (A) is defensible, the ParentalGate path could return, but the copy
   still may not say a parent consented.
3. **Ingress log retention.** How long the cluster keeps access logs with
   client IPs is not documented anywhere in this repo, and the privacy
   policy does not currently mention server logs at all. That gap
   predates I-003 but the IP sentence in Decision 7 depends on it.
