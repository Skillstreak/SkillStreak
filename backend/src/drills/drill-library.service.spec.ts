import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DrillReviewNotFoundException,
  DrillReviewStaleException,
} from '../common/errors/exceptions';
import {
  ANONYMOUS_AUTHOR,
  DrillLibraryService,
  drillContentSha256,
  parseDrill,
} from './drill-library.service';
import { DrillReview, DrillReviewStatus } from './entities/drill-review.entity';

const VALID = `---
title: "Kortpassningar under press"
ageBand: "9-11"
focus: "passning"
durationMinutes: 15
locale: "sv"
author: "Anna Lindqvist"
authorConsentedNamed: true
sourceNote: "Delad av författaren"
---

Body prose.
`;

describe('parseDrill', () => {
  it('reads the front matter and keeps the body', () => {
    const drill = parseDrill('kortpassningar.md', VALID);

    expect(drill).toMatchObject({
      slug: 'kortpassningar',
      title: 'Kortpassningar under press',
      ageBand: '9-11',
      focus: 'passning',
      durationMinutes: 15,
      author: 'Anna Lindqvist',
    });
    expect(drill.body).toBe('Body prose.');
  });

  it('rejects an age band outside the fixed vocabulary', () => {
    // The enums are the point: a general YAML parser would accept far more
    // than this format allows, which is why the parser is hand-rolled.
    expect(() => parseDrill('x.md', VALID.replace('"9-11"', '"5-7"'))).toThrow(
      /ageBand/,
    );
  });

  it('rejects a focus outside the fixed vocabulary', () => {
    expect(() =>
      parseDrill('x.md', VALID.replace('"passning"', '"kondition"')),
    ).toThrow(/focus/);
  });

  it('rejects a non-numeric or zero duration', () => {
    expect(() => parseDrill('x.md', VALID.replace('15', 'femton'))).toThrow(
      /durationMinutes/,
    );
    expect(() => parseDrill('x.md', VALID.replace('15', '0'))).toThrow(
      /durationMinutes/,
    );
  });

  it('rejects a file with no front matter at all', () => {
    expect(() => parseDrill('x.md', 'just some prose')).toThrow(/front matter/);
  });

  it('reports which required field is missing', () => {
    expect(() =>
      parseDrill(
        'x.md',
        VALID.replace('title: "Kortpassningar under press"\n', ''),
      ),
    ).toThrow(/title/);
  });

  it('strips trailing comments from a field', () => {
    const drill = parseDrill(
      'x.md',
      VALID.replace('"9-11"', '"9-11"   # fixed enum'),
    );

    expect(drill.ageBand).toBe('9-11');
  });

  it('treats a missing sourceNote as absent rather than failing', () => {
    const drill = parseDrill(
      'x.md',
      VALID.replace('sourceNote: "Delad av författaren"\n', ''),
    );

    expect(drill.sourceNote).toBeNull();
  });
});

/**
 * ADR-0029 Decision 5's content rules, which were specified and then
 * enforced by nothing. Both were security-review findings.
 */
describe('parseDrill: Decision 5 content rules', () => {
  const withBody = (body: string) =>
    VALID.replace('Body prose.', body).replace(
      'author: "Anna Lindqvist"',
      'author: "Anonym tränare"',
    );

  it.each([
    ['a URL', 'Se mer på https://example.se/övning'],
    ['a bare www URL', 'Se www.example.se för mer'],
    ['an email address', 'Hör av dig till anna@example.se'],
    ['a phone number', 'Ring mig på 070-123 45 67'],
  ])('rejects a body containing %s', (_label, body) => {
    // A contact detail here is an off-platform channel from an unvetted
    // adult to coaches who work with children — and, once the AI cluster
    // reads this corpus, model grounding as well.
    expect(() => parseDrill('x.md', withBody(body))).toThrow(/Decision 5/);
  });

  it('does not mistake ordinary numbers in a drill for a phone number', () => {
    // Rep counts, durations and years are the whole vocabulary of a drill.
    expect(() =>
      parseDrill('x.md', withBody('4 varv om 30 sekunder, 2026 års upplägg')),
    ).not.toThrow();
  });

  it('refuses a named author whose permission was not recorded', () => {
    // The file itself is the licence record. A name published against a
    // "false" is the exact contradiction the field exists to prevent.
    expect(() =>
      parseDrill(
        'x.md',
        VALID.replace(
          'authorConsentedNamed: true',
          'authorConsentedNamed: false',
        ),
      ),
    ).toThrow(/authorConsentedNamed/);
  });

  it('accepts a named author whose permission was recorded', () => {
    expect(() => parseDrill('x.md', VALID)).not.toThrow();
  });

  it('needs no permission for the anonymous author, who identifies nobody', () => {
    expect(() =>
      parseDrill(
        'x.md',
        VALID.replace('author: "Anna Lindqvist"', 'author: "Anonym tränare"'),
      ),
    ).not.toThrow();
  });
});

/**
 * The first phone heuristic rejected "Tillagd 2026-08-11" and "30 30 30 30
 * 30 30 sekunder" — both ordinary drill prose. A rejected drill is a
 * missing row and a warning nobody reads, so over-eagerness here fails
 * invisibly, which is the wrong direction to err in.
 */
describe('parseDrill: the phone heuristic vs ordinary drill prose', () => {
  const withBody = (body: string) =>
    VALID.replace('Body prose.', body).replace(
      'author: "Anna Lindqvist"',
      'author: "Anonym tränare"',
    );

  it.each([
    'Tillagd 2026-08-11 av tränaren.',
    'Kör intervaller: 30 30 30 30 30 30 sekunder.',
    'Stationer 1 2 3 4 5 6 7 8 i tur och ordning.',
    '3 x 10 reps, 4 set, 2 min vila.',
    'Passa 20 gånger på 45 sekunder, 3 varv.',
  ])('accepts %p', (body) => {
    expect(() => parseDrill('x.md', withBody(body))).not.toThrow();
  });

  it.each([
    'Ring mig på 070-123 45 67',
    'Nås på +46701234567',
    'Mobil: 0701234567',
  ])('still rejects %p', (body) => {
    expect(() => parseDrill('x.md', withBody(body))).toThrow(/phone number/);
  });
});

/**
 * The shipped library itself must parse. Every other test here uses a
 * fixture, so a rule that rejects the real files would pass CI and empty
 * the shelf in production — visible only via /health's drill count, after
 * deploy.
 */
describe('the drill library files that actually ship', () => {
  it('every file in src/drills/library parses', () => {
    const dir = join(__dirname, 'library');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(() =>
        parseDrill(file, readFileSync(join(dir, file), 'utf8')),
      ).not.toThrow();
    }
  });
});

/**
 * The review gate.
 *
 * These exist because the previous marker was the word "UTKAST" written
 * into `sourceNote`, which no code read — so twelve unreviewed drills were
 * served to coaches and used as the training-plan model's corpus while
 * appearing, in the files, to be held back. The lesson is not "add a
 * field"; it is that a gate nothing asserts is indistinguishable from no
 * gate, which is why the service-level test below reads the real library
 * rather than a fixture.
 */
describe('parseDrill: the coach-review gate', () => {
  const withReview = (value: string | null) =>
    parseDrill(
      'x.md',
      [
        '---',
        'title: "T"',
        'ageBand: "9-11"',
        'focus: "teknik"',
        'durationMinutes: 15',
        'locale: "sv"',
        `author: "${ANONYMOUS_AUTHOR}"`,
        ...(value === null ? [] : [`coachReviewed: ${value}`]),
        '---',
        '',
        'Kropp.',
      ].join('\n'),
    );

  it('treats a missing coachReviewed as not reviewed', () => {
    expect(withReview(null).coachReviewed).toBe(false);
  });

  it('publishes only on an explicit true', () => {
    expect(withReview('true').coachReviewed).toBe(true);
    expect(withReview('false').coachReviewed).toBe(false);
    // Anything that is not "true" is not a review. A typo must fail
    // closed, in the direction that withholds rather than publishes.
    expect(withReview('yes').coachReviewed).toBe(false);
    expect(withReview('TRUE').coachReviewed).toBe(true);
  });
});

/**
 * A stand-in for the `drill_review` repository, holding rows in memory.
 * `find({ where: { status } })` filters like the real query does, so the
 * service's own filtering is what these tests exercise.
 */
function reviewRepo(initial: Partial<DrillReview>[] = []) {
  const rows = new Map<string, DrillReview>(
    initial.map((row) => [
      row.drillSlug!,
      {
        reviewedByStaffAccountId: 'staff-1',
        reviewedAt: new Date('2026-11-20T08:00:00Z'),
        rejectionReason: null,
        ...row,
      } as DrillReview,
    ]),
  );
  return {
    rows,
    find: jest.fn((options?: { where?: { status?: DrillReviewStatus } }) =>
      Promise.resolve(
        [...rows.values()].filter(
          (row) =>
            !options?.where?.status || row.status === options.where.status,
        ),
      ),
    ),
    findOne: jest.fn((options: { where: { drillSlug: string } }) =>
      Promise.resolve(rows.get(options.where.drillSlug) ?? null),
    ),
    create: (row: DrillReview) => row,
    save: jest.fn((row: DrillReview) => {
      rows.set(row.drillSlug, row);
      return Promise.resolve(row);
    }),
  };
}

const libraryDir = join(__dirname, 'library');
const onDisk = readdirSync(libraryDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const raw = readFileSync(join(libraryDir, f), 'utf8');
    return { drill: parseDrill(f, raw), sha: drillContentSha256(raw) };
  });
const gitReviewed = onDisk.filter((d) => d.drill.coachReviewed);
const awaiting = onDisk.filter((d) => !d.drill.coachReviewed);

describe('DrillLibraryService: unreviewed drills are not served', () => {
  const service = new DrillLibraryService(reviewRepo() as never);

  it('serves exactly the coach-reviewed files and no others', async () => {
    const reviewed = gitReviewed.map((d) => d.drill.slug);
    expect((await service.list()).map((d) => d.slug).sort()).toEqual(
      reviewed.sort(),
    );
  });

  it('never includes author, authorConsentedNamed or sourceNote in a listing (Juridik R1)', async () => {
    const list = await service.list();
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(item).not.toHaveProperty('author');
      expect(item).not.toHaveProperty('authorConsentedNamed');
      expect(item).not.toHaveProperty('sourceNote');
    }
  });

  it('cannot reach an unreviewed drill by slug either', async () => {
    // The listing and the lookup are separate paths, and hiding a drill
    // from one while leaving it fetchable by the other would be the more
    // dangerous half working.
    for (const { drill } of awaiting) {
      expect(await service.findBySlug(drill.slug)).toBeNull();
    }
    expect(
      await service.findBySlugs(awaiting.map((d) => d.drill.slug)),
    ).toEqual([]);
  });

  it('withholds something right now, so this suite is not vacuous', () => {
    // If every drill is approved one day this flips to a bare assertion
    // that nothing is withheld — which is fine, but it should be a
    // deliberate edit rather than a test that quietly stopped checking.
    expect(awaiting.length).toBeGreaterThan(0);
  });
});

/**
 * ADR-0035's 2026-11-20 amendment: the four visibility cases, one each.
 * Visible = file says true, OR file says false and an approval row matches
 * the file's current content.
 */
describe('DrillLibraryService: visibility with staff review', () => {
  const target = awaiting[0];
  const slug = target.drill.slug;

  async function visible(service: DrillLibraryService): Promise<boolean> {
    const listed = (await service.list()).some((d) => d.slug === slug);
    const found = (await service.findBySlug(slug)) !== null;
    // The two read paths must always agree.
    expect(listed).toBe(found);
    return found;
  }

  it('file coachReviewed: true → visible, whatever the table says', async () => {
    const reviewed = gitReviewed[0].drill.slug;
    const service = new DrillLibraryService(
      reviewRepo([
        {
          drillSlug: reviewed,
          status: DrillReviewStatus.REJECTED,
          contentSha256: gitReviewed[0].sha,
          rejectionReason: 'ignored',
        },
      ]) as never,
    );
    expect(await service.findBySlug(reviewed)).not.toBeNull();
  });

  it('file false + approval for this content → visible', async () => {
    const service = new DrillLibraryService(
      reviewRepo([
        {
          drillSlug: slug,
          status: DrillReviewStatus.APPROVED,
          contentSha256: target.sha,
        },
      ]) as never,
    );
    expect(await visible(service)).toBe(true);
    expect(await service.countVisible()).toBe(gitReviewed.length + 1);
  });

  it('file false + rejection → hidden', async () => {
    const service = new DrillLibraryService(
      reviewRepo([
        {
          drillSlug: slug,
          status: DrillReviewStatus.REJECTED,
          contentSha256: target.sha,
          rejectionReason: 'Inte för nioåringar.',
        },
      ]) as never,
    );
    expect(await visible(service)).toBe(false);
    expect(await service.countVisible()).toBe(gitReviewed.length);
  });

  it('file false + no row → hidden', async () => {
    const service = new DrillLibraryService(reviewRepo() as never);
    expect(await visible(service)).toBe(false);
  });

  it('file false + approval of DIFFERENT content → hidden, and pending again', async () => {
    // An approval is of a text, not a name. If the file changes after
    // approval, the new text has not been read by anyone.
    const service = new DrillLibraryService(
      reviewRepo([
        {
          drillSlug: slug,
          status: DrillReviewStatus.APPROVED,
          contentSha256: 'f'.repeat(64),
        },
      ]) as never,
    );
    expect(await visible(service)).toBe(false);
    const view = await service.findForReview(slug);
    expect(view.state).toBe('pending');
    expect(view.changedSinceReview).toBe(true);
  });

  it('fails closed when the approvals cannot be read', async () => {
    const repo = reviewRepo([
      {
        drillSlug: slug,
        status: DrillReviewStatus.APPROVED,
        contentSha256: target.sha,
      },
    ]);
    repo.find.mockRejectedValue(new Error('connection refused'));
    const service = new DrillLibraryService(repo as never);
    expect(await visible(service)).toBe(false);
    expect((await service.list()).length).toBe(gitReviewed.length);
  });

  it('health count falls back to git-reviewed when the lookup hangs', async () => {
    jest.useFakeTimers();
    try {
      const repo = reviewRepo();
      repo.find.mockReturnValue(new Promise<DrillReview[]>(() => undefined));
      const service = new DrillLibraryService(repo as never);
      const count = service.countVisible();
      await jest.advanceTimersByTimeAsync(600);
      expect(await count).toBe(gitReviewed.length);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reads approvals per request, so a decision on another pod applies at once', async () => {
    // Two API pods in prod: the service must not cache a verdict that
    // another replica can change.
    const repo = reviewRepo();
    const service = new DrillLibraryService(repo as never);
    expect(await visible(service)).toBe(false);
    repo.rows.set(slug, {
      drillSlug: slug,
      status: DrillReviewStatus.APPROVED,
      contentSha256: target.sha,
      reviewedByStaffAccountId: 'other-pod',
      reviewedAt: new Date(),
      rejectionReason: null,
    });
    expect(await visible(service)).toBe(true);
    repo.rows.set(slug, {
      ...repo.rows.get(slug)!,
      status: DrillReviewStatus.REJECTED,
      rejectionReason: 'Taken down.',
    });
    expect(await visible(service)).toBe(false);
  });
});

describe('DrillLibraryService: recording a decision', () => {
  const target = awaiting[0];
  const slug = target.drill.slug;

  it('approves, records who and when, and makes the drill visible', async () => {
    const repo = reviewRepo();
    const service = new DrillLibraryService(repo as never);

    const view = await service.decide('staff-42', slug, {
      status: DrillReviewStatus.APPROVED,
      contentSha256: target.sha,
    });

    expect(view.state).toBe('approved');
    expect(view.reviewedByStaffAccountId).toBe('staff-42');
    expect(view.reviewedAt).not.toBeNull();
    expect(repo.rows.get(slug)).toMatchObject({
      status: DrillReviewStatus.APPROVED,
      contentSha256: target.sha,
      reviewedByStaffAccountId: 'staff-42',
      rejectionReason: null,
    });
    expect(await service.findBySlug(slug)).not.toBeNull();
  });

  it('a rejection after an approval takes the drill down', async () => {
    const repo = reviewRepo([
      {
        drillSlug: slug,
        status: DrillReviewStatus.APPROVED,
        contentSha256: target.sha,
      },
    ]);
    const service = new DrillLibraryService(repo as never);
    await service.decide('staff-42', slug, {
      status: DrillReviewStatus.REJECTED,
      contentSha256: target.sha,
      reason: '  Fel åldersgrupp.  ',
    });
    expect(repo.rows.get(slug)?.rejectionReason).toBe('Fel åldersgrupp.');
    expect(await service.findBySlug(slug)).toBeNull();
  });

  it('refuses a decision on a version of the file the reviewer did not read', async () => {
    const repo = reviewRepo();
    const service = new DrillLibraryService(repo as never);
    await expect(
      service.decide('staff-42', slug, {
        status: DrillReviewStatus.APPROVED,
        contentSha256: '0'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(DrillReviewStaleException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('only reviews coachReviewed: false files — a git-reviewed or unknown slug is 404', async () => {
    const service = new DrillLibraryService(reviewRepo() as never);
    await expect(
      service.decide('staff-42', gitReviewed[0].drill.slug, {
        status: DrillReviewStatus.REJECTED,
        contentSha256: gitReviewed[0].sha,
        reason: 'nope',
      }),
    ).rejects.toBeInstanceOf(DrillReviewNotFoundException);
    await expect(service.findForReview('no-such-drill')).rejects.toBeInstanceOf(
      DrillReviewNotFoundException,
    );
  });

  it('lists every awaiting drill for review, with author and sourceNote for staff', async () => {
    const service = new DrillLibraryService(reviewRepo() as never);
    const queue = await service.listForReview();
    expect(queue.map((d) => d.slug).sort()).toEqual(
      awaiting.map((d) => d.drill.slug).sort(),
    );
    expect(queue.every((d) => d.state === 'pending')).toBe(true);
    expect(queue[0]).toHaveProperty('author');
    expect(queue[0]).toHaveProperty('sourceNote');
  });
});
