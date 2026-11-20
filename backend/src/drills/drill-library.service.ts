import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import {
  DrillReviewNotFoundException,
  DrillReviewStaleException,
} from '../common/errors/exceptions';
import { DrillReview, DrillReviewStatus } from './entities/drill-review.entity';

/** The one author value that needs no recorded permission, because it
 *  identifies nobody. */
export const ANONYMOUS_AUTHOR = 'Anonym tränare';

export const DRILL_AGE_BANDS = ['9-11', '11-13', '13+'] as const;
export const DRILL_FOCUSES = [
  'teknik',
  'fys',
  'skott',
  'passning',
  'spelforstaelse',
] as const;

export type DrillAgeBand = (typeof DRILL_AGE_BANDS)[number];
export type DrillFocus = (typeof DRILL_FOCUSES)[number];

export interface Drill {
  slug: string;
  title: string;
  ageBand: DrillAgeBand;
  focus: DrillFocus;
  durationMinutes: number;
  locale: string;
  author: string;
  sourceNote: string | null;
  /**
   * Whether a coach has actually read this drill and vouched for it in
   * git.
   *
   * Absent means false. Fail-closed on purpose: the failure this guards
   * against is unreviewed training advice reaching children, and a
   * forgotten field must not be the thing that publishes it. Since the
   * 2026-11-20 amendment to ADR-0035, a `false` drill can also be approved
   * by staff in the console — see DrillLibraryService.
   */
  coachReviewed: boolean;
  /** Markdown prose. Rendered escaped — it is text a human wrote, not markup. */
  body: string;
}

/**
 * The listing shape: everything except the body, which is often long,
 * and except `coachReviewed`.
 *
 * That second omission is the point rather than an oversight. Nothing
 * outside this file can obtain an unreviewed drill through `list` or
 * `findBySlug` — review state is resolved here, once — so the field would
 * say nothing a caller could use, and would invite branching on it at the
 * edges instead of trusting the filtering at the centre.
 */
// author, authorConsentedNamed and sourceNote stay server-side (Juridik R1).
export type DrillSummary = Omit<
  Drill,
  'body' | 'coachReviewed' | 'author' | 'sourceNote'
>;

/** Where a `coachReviewed: false` drill stands with staff review. */
export type DrillReviewState = 'pending' | 'approved' | 'rejected';

/**
 * A drill as the staff review queue sees it (ADR-0035's 2026-11-20
 * amendment). Admin-only: it carries `author` and `sourceNote`, which
 * staff may read and which never reach a player client.
 */
export interface DrillReviewView {
  slug: string;
  title: string;
  ageBand: DrillAgeBand;
  focus: DrillFocus;
  durationMinutes: number;
  locale: string;
  author: string;
  sourceNote: string | null;
  body: string;
  /** Hash of the file as this pod has it. Sent back with a decision so a
   *  reviewer can only approve the text they actually read. */
  contentSha256: string;
  state: DrillReviewState;
  /** A decision exists but was made on a different version of the file,
   *  so it no longer applies and the drill is pending again. */
  changedSinceReview: boolean;
  reviewedByStaffAccountId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export type DrillReviewDecision =
  | { status: DrillReviewStatus.APPROVED; contentSha256: string }
  | {
      status: DrillReviewStatus.REJECTED;
      contentSha256: string;
      reason: string;
    };

interface LoadedDrill {
  drill: Drill;
  contentSha256: string;
}

/** How long `/health` waits for the approval lookup before reporting the
 *  git-reviewed count alone. A probe must not hang on Postgres, and the
 *  startup probe has the Kubernetes default 1s timeout (k8s/api-deployment). */
const HEALTH_LOOKUP_TIMEOUT_MS = 500;

/**
 * The coach drill library (ADR-0029 Decision 2).
 *
 * **There is deliberately no drill table.** Drills are Markdown files in
 * this repository, read once at boot. That is the point rather than a
 * shortcut: with no `drill` row, there is nothing for any query in this
 * app to join to a `player`, `team`, `video_clip` or `training_log_entry`
 * — Decision 1's "no per-child reference in the library" is
 * unrepresentable rather than merely forbidden. It also means the library
 * needs no entry in ADR-0013's per-entity erasure table, because there is
 * nothing about a child to erase.
 *
 * Moderation is a human, recorded in one of two places:
 *
 *  1. **git** — `coachReviewed: true` in the file's front matter, arriving
 *     as a reviewed diff through the existing merge flow. Visible always.
 *  2. **the staff console** (ADR-0035's 2026-11-20 amendment) — a
 *     `drill_review` row saying an admin approved *this exact file
 *     content*, by SHA-256. Only consulted for `coachReviewed: false`
 *     files. The row holds a slug, a verdict and who gave it; the drill
 *     text itself still lives only in git.
 *
 * Decision 5 is still explicit that this is a *policy* control and must
 * not be described to anyone as filtered or checked content.
 *
 * **Approvals are read from Postgres on every request, not cached.** Prod
 * runs two API pods; an approval or a take-down written through one must
 * hold on the other immediately, and an in-process cache invalidated only
 * locally would let a rejected drill keep serving from the other pod. The
 * lookup is a primary-key-sized read of a table with tens of rows, and it
 * is skipped entirely when no file is awaiting review. On a database error
 * it fails closed: console-approved drills are withheld and git-reviewed
 * ones still serve.
 *
 * Same file mechanism as the Swedish wordlist — static, reviewable,
 * version-controlled data shipped into the image via `nest-cli.json`'s
 * `assets` entry and loaded with `readFileSync` relative to `__dirname`.
 *
 * Malformed files are skipped with a warning rather than crashing boot.
 * A typo in one drill's front matter must not take the API down; the
 * missing drill is visible in the console, and the log names the file.
 */
@Injectable()
export class DrillLibraryService {
  private readonly logger = new Logger(DrillLibraryService.name);
  /** Reviewed in git — visible unconditionally. */
  private readonly gitReviewed: Drill[];
  /** `coachReviewed: false` — visible only with a matching DB approval. */
  private readonly awaitingReview: LoadedDrill[];

  constructor(
    @InjectRepository(DrillReview)
    private readonly reviewRepository: Repository<DrillReview>,
  ) {
    // Split once, here, rather than filtered at each call site. Seven
    // places read this library — the coach API, drill groups, the health
    // count and the training-plan corpus among them — and a filter each of
    // them has to remember is a filter one of them will eventually forget.
    // Every public read goes through `visible()`; only the admin-only
    // review methods ever touch `awaitingReview` directly.
    const all = this.loadAll();
    this.gitReviewed = all
      .filter((loaded) => loaded.drill.coachReviewed)
      .map((loaded) => loaded.drill);
    this.awaitingReview = all.filter((loaded) => !loaded.drill.coachReviewed);

    this.logger.log(
      `Drill library loaded: ${this.gitReviewed.length} coach-reviewed drill(s)` +
        (this.awaitingReview.length > 0
          ? `, ${this.awaitingReview.length} visible only once approved in the staff console (or set coachReviewed: true)`
          : '') +
        '.',
    );
  }

  async list(filter?: {
    ageBand?: string;
    focus?: string;
    locale?: string;
  }): Promise<DrillSummary[]> {
    return toSummaries(await this.visible(), filter);
  }

  async findBySlug(slug: string): Promise<Drill | null> {
    return (await this.visible()).find((drill) => drill.slug === slug) ?? null;
  }

  /** Several at once, in the order asked, with one approval lookup rather
   *  than one per slug. Slugs not currently visible are dropped. */
  async findBySlugs(slugs: string[]): Promise<Drill[]> {
    const bySlug = new Map(
      (await this.visible()).map((drill) => [drill.slug, drill]),
    );
    return slugs
      .map((slug) => bySlug.get(slug))
      .filter((drill): drill is Drill => Boolean(drill));
  }

  /**
   * How many drills are visible right now, for `/health`.
   *
   * Bounded: the probe must answer even if Postgres is slow, so after
   * HEALTH_LOOKUP_TIMEOUT_MS it reports the git-reviewed count alone —
   * the same fail-closed answer a database error gives.
   */
  async countVisible(): Promise<number> {
    let timer: NodeJS.Timeout | undefined;
    const fallback = new Promise<Set<string>>((resolve) => {
      timer = setTimeout(() => resolve(new Set()), HEALTH_LOOKUP_TIMEOUT_MS);
    });
    try {
      const approved = await Promise.race([this.approvedSlugs(), fallback]);
      return this.gitReviewed.length + approved.size;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- staff review: admin-only callers ---------------------------------

  /** Every `coachReviewed: false` drill with its current review state. */
  async listForReview(): Promise<DrillReviewView[]> {
    if (!this.awaitingReview.length) return [];
    const rows = await this.reviewRepository.find();
    const bySlug = new Map(rows.map((row) => [row.drillSlug, row]));
    return this.awaitingReview
      .map((loaded) => toReviewView(loaded, bySlug.get(loaded.drill.slug)))
      .sort((a, b) => a.title.localeCompare(b.title, 'sv'));
  }

  async findForReview(slug: string): Promise<DrillReviewView> {
    const loaded = this.findAwaiting(slug);
    const row = await this.reviewRepository.findOne({
      where: { drillSlug: loaded.drill.slug },
    });
    return toReviewView(loaded, row ?? undefined);
  }

  /**
   * Record a staff decision on a `coachReviewed: false` drill, replacing
   * any earlier one — so a reject after an approval is the take-down.
   *
   * `contentSha256` is the hash the reviewer's screen was showing. If the
   * file has changed since (a deploy between opening and deciding), the
   * decision is refused rather than applied to text nobody read.
   */
  async decide(
    reviewerStaffAccountId: string,
    slug: string,
    decision: DrillReviewDecision,
  ): Promise<DrillReviewView> {
    const loaded = this.findAwaiting(slug);
    if (decision.contentSha256 !== loaded.contentSha256) {
      throw new DrillReviewStaleException();
    }

    const row = this.reviewRepository.create({
      drillSlug: loaded.drill.slug,
      status: decision.status,
      contentSha256: loaded.contentSha256,
      reviewedByStaffAccountId: reviewerStaffAccountId,
      reviewedAt: new Date(),
      rejectionReason:
        decision.status === DrillReviewStatus.REJECTED
          ? decision.reason.trim()
          : null,
    });
    await this.reviewRepository.save(row);

    this.logger.log(
      `Drill "${loaded.drill.slug}" ${decision.status} by staff account ${reviewerStaffAccountId}.`,
    );
    return toReviewView(loaded, row);
  }

  /** Only `coachReviewed: false` files are reviewable here. A git-reviewed
   *  drill was approved in a diff and is changed in a diff. */
  private findAwaiting(slug: string): LoadedDrill {
    const loaded = this.awaitingReview.find((l) => l.drill.slug === slug);
    if (!loaded) throw new DrillReviewNotFoundException();
    return loaded;
  }

  // ---- visibility ---------------------------------------------------------

  private async visible(): Promise<Drill[]> {
    const approved = await this.approvedSlugs();
    if (!approved.size) return this.gitReviewed;
    return [
      ...this.gitReviewed,
      ...this.awaitingReview
        .filter((loaded) => approved.has(loaded.drill.slug))
        .map((loaded) => loaded.drill),
    ];
  }

  /**
   * Slugs of `coachReviewed: false` drills with an approval matching their
   * current content. Fails closed: any error means "none approved".
   */
  private async approvedSlugs(): Promise<Set<string>> {
    if (!this.awaitingReview.length) return new Set();
    let rows: DrillReview[];
    try {
      rows = await this.reviewRepository.find({
        where: { status: DrillReviewStatus.APPROVED },
        select: { drillSlug: true, contentSha256: true },
      });
    } catch (error) {
      this.logger.warn(
        `Drill approvals could not be read; serving git-reviewed drills only — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return new Set();
    }
    const hashBySlug = new Map(
      rows.map((row) => [row.drillSlug, row.contentSha256]),
    );
    return new Set(
      this.awaitingReview
        .filter(
          (loaded) =>
            hashBySlug.get(loaded.drill.slug) === loaded.contentSha256,
        )
        .map((loaded) => loaded.drill.slug),
    );
  }

  private loadAll(): LoadedDrill[] {
    const dir = join(__dirname, 'library');
    let files: string[];
    try {
      files = readdirSync(dir).filter((name) => name.endsWith('.md'));
    } catch {
      // An empty or absent library is a valid state — the console shows an
      // empty shelf and says so. Not a reason to refuse to boot.
      this.logger.warn(`No drill library found at ${dir}.`);
      return [];
    }

    const loaded: LoadedDrill[] = [];
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), 'utf8');
        loaded.push({
          drill: parseDrill(file, raw),
          contentSha256: drillContentSha256(raw),
        });
      } catch (error) {
        this.logger.warn(
          `Skipping drill "${file}" — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return loaded;
  }
}

/** The identity an approval is bound to: the file's exact bytes. */
export function drillContentSha256(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function toSummaries(
  drills: Drill[],
  filter?: { ageBand?: string; focus?: string; locale?: string },
): DrillSummary[] {
  return (
    drills
      .filter(
        (drill) =>
          (!filter?.ageBand || drill.ageBand === filter.ageBand) &&
          (!filter?.focus || drill.focus === filter.focus) &&
          (!filter?.locale || drill.locale === filter.locale),
      )
      // Body dropped explicitly rather than by destructuring, so the
      // listing's shape is a written decision instead of a side effect of
      // which fields happened to be omitted.
      .map((drill) => ({
        slug: drill.slug,
        title: drill.title,
        ageBand: drill.ageBand,
        focus: drill.focus,
        durationMinutes: drill.durationMinutes,
        locale: drill.locale,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'sv'))
  );
}

/**
 * The review state of one awaiting drill. A row whose hash does not match
 * the file is shown as pending with `changedSinceReview`, never as its old
 * verdict — that verdict was about different text.
 */
function toReviewView(
  loaded: LoadedDrill,
  row: DrillReview | undefined,
): DrillReviewView {
  const { drill } = loaded;
  const current =
    row && row.contentSha256 === loaded.contentSha256 ? row : undefined;
  return {
    slug: drill.slug,
    title: drill.title,
    ageBand: drill.ageBand,
    focus: drill.focus,
    durationMinutes: drill.durationMinutes,
    locale: drill.locale,
    author: drill.author,
    sourceNote: drill.sourceNote,
    body: drill.body,
    contentSha256: loaded.contentSha256,
    state: !current
      ? 'pending'
      : current.status === DrillReviewStatus.APPROVED
        ? 'approved'
        : 'rejected',
    changedSinceReview: Boolean(row) && !current,
    reviewedByStaffAccountId: current?.reviewedByStaffAccountId ?? null,
    reviewedAt: current ? current.reviewedAt.toISOString() : null,
    rejectionReason: current?.rejectionReason ?? null,
  };
}

/**
 * Parses one drill file.
 *
 * Hand-rolled rather than a YAML dependency: the front matter is six
 * scalar fields with a fixed vocabulary, and a general YAML parser would
 * accept far more than this format allows — including nested structures
 * and type coercions that the enum checks below would then have to
 * re-reject. Strict is easier here than permissive.
 */
export function parseDrill(fileName: string, raw: string): Drill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw.trim());
  if (!match) throw new Error('no front matter block');

  const [, frontMatter, body] = match;
  const fields = new Map<string, string>();
  for (const line of frontMatter.split(/\r?\n/)) {
    const fieldMatch = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
    if (!fieldMatch) continue;
    // Strip surrounding quotes and any trailing `# comment`.
    const value = fieldMatch[2]
      .replace(/\s+#.*$/, '')
      .trim()
      .replace(/^"(.*)"$/, '$1');
    fields.set(fieldMatch[1], value);
  }

  const required = (key: string): string => {
    const value = fields.get(key);
    if (!value) throw new Error(`missing "${key}"`);
    return value;
  };

  const ageBand = required('ageBand');
  if (!(DRILL_AGE_BANDS as readonly string[]).includes(ageBand)) {
    throw new Error(`ageBand "${ageBand}" is not one of the allowed bands`);
  }
  const focus = required('focus');
  if (!(DRILL_FOCUSES as readonly string[]).includes(focus)) {
    throw new Error(`focus "${focus}" is not one of the allowed values`);
  }
  const durationMinutes = Number(required('durationMinutes'));
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error('durationMinutes must be a positive whole number');
  }

  // ADR-0029 Decision 5 says the body carries no links, email addresses or
  // phone numbers, and until now nothing enforced it. That matters more
  // than it looks: a contact detail here is an off-platform channel from
  // an unvetted adult to coaches who work with children — a different
  // feature with a different review — and once ADR-0028 Phase 1 reads this
  // same corpus, the string becomes model grounding too.
  //
  // Rejecting the whole file rather than stripping the match: a drill that
  // was written to point somewhere should not be silently published with
  // the pointer removed and its meaning changed.
  const contact = findContactDetail(body);
  if (contact) {
    throw new Error(
      `body contains what looks like ${contact} — Decision 5 allows no links, emails or phone numbers`,
    );
  }

  // Decision 5 makes contribution a licence event and puts the record in
  // the file rather than in someone's inbox. It was being parsed by
  // nothing, so a file could say permission was NOT given and publish a
  // real adult's name anyway. The permission and the name must agree.
  const author = required('author');
  const consented = (fields.get('authorConsentedNamed') ?? '').toLowerCase();
  if (author !== ANONYMOUS_AUTHOR && consented !== 'true') {
    throw new Error(
      `author "${author}" is named but authorConsentedNamed is not true — use "${ANONYMOUS_AUTHOR}" or record the permission`,
    );
  }

  // Parsed, not inferred. The previous marker was the word "UTKAST" inside
  // `sourceNote`, which no code read — so twelve unreviewed drills were
  // being served to coaches and used as the training-plan model's corpus
  // while looking, in the files, like they were being held back. A comment
  // that asserts something the code does not do is worse than no comment,
  // because it stops anyone checking.
  const coachReviewed =
    (fields.get('coachReviewed') ?? '').toLowerCase() === 'true';

  return {
    slug: fileName.replace(/\.md$/, ''),
    title: required('title'),
    ageBand: ageBand as DrillAgeBand,
    focus: focus as DrillFocus,
    durationMinutes,
    locale: required('locale'),
    author,
    sourceNote: fields.get('sourceNote') ?? null,
    coachReviewed,
    body: body.trim(),
  };
}

/**
 * Looks for an off-platform contact detail in drill prose.
 *
 * Deliberately blunt and slightly over-eager: a false positive costs one
 * rejected file with a named reason in the log, which the author fixes in
 * a minute. A false negative publishes a contact channel to coaches. The
 * asymmetry says which way to lean.
 */
export function findContactDetail(body: string): string | null {
  if (/https?:\/\//i.test(body)) return 'a URL';
  if (/\bwww\.[a-z0-9-]+\.[a-z]{2,}/i.test(body)) return 'a URL';
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(body)) {
    return 'an email address';
  }
  // Phone numbers, without eating ordinary drill prose.
  //
  // The first version was `(?:\+?\d[\s\-()]*){7,}`, which rejected far more
  // than phone numbers: a run of seven digits separated by spaces or
  // dashes is completely normal here, so "Tillagd 2026-08-11" and "30 30
  // 30 30 30 30 sekunder" were both refused. A rejected drill is a missing
  // row and a warning nobody reads, so over-eagerness fails INVISIBLY —
  // the opposite of the asymmetry that comment claimed.
  //
  // The second attempt stripped whitespace before matching, which
  // reintroduced the same fault by a different route: "30 30 30 30 30 30"
  // compacts to twelve consecutive digits. Space-separated digits are
  // interval and station lists, and must not be joined.
  //
  // So: an international number, a solid run of 8+ digits, or Swedish
  // grouping — each matched against the text as written.
  if (/\+\d[\d\s-]{7,}/.test(body)) return 'a phone number';
  if (/(?<!\d)\d{8,}(?!\d)/.test(body)) return 'a phone number';
  if (/\b0\d{1,3}[-\s]\d{2,3}[-\s]?\d{2}[-\s]?\d{2}\b/.test(body)) {
    return 'a phone number';
  }

  return null;
}
