import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DrillReviewNotFoundException } from '../common/errors/exceptions';
import { AdminAuthGuard } from '../staff-auth/guards/admin-auth.guard';
import { PtAuthGuard } from '../staff-auth/guards/pt-auth.guard';
import { AdminDrillReviewsController } from './admin-drill-reviews.controller';
import { ApproveDrillDto, RejectDrillDto } from './dto/drill-review.dto';
import { DrillReviewStatus } from './entities/drill-review.entity';

/**
 * The guard is the whole access control on what enters the drill library
 * (ADR-0035's 2026-11-20 amendment), so it is asserted directly rather than
 * trusted to a decorator nobody re-reads. AdminAuthGuard's own behaviour —
 * revoked accounts, the live ADMIN_EMAILS re-check, a `pt` refused — is
 * covered in admin-auth.guard.spec.ts; this pins that it is the guard here.
 */
describe('AdminDrillReviewsController guard', () => {
  it('is guarded at class level by AdminAuthGuard', () => {
    const guards: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminDrillReviewsController,
    );
    expect(guards).toEqual([AdminAuthGuard]);
  });

  it('is not reachable through the trainer guard', () => {
    // PtAuthGuard admits `pt` as well as `admin`. A trainer must not be
    // able to approve drills into the library they read from.
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminDrillReviewsController,
    ) as unknown[];
    expect(guards).not.toContain(PtAuthGuard);
  });

  it('no route overrides the class guard with a weaker one', () => {
    const proto = AdminDrillReviewsController.prototype as unknown as Record<
      string,
      object
    >;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      expect(Reflect.getMetadata(GUARDS_METADATA, proto[name])).toBeUndefined();
    }
  });
});

describe('AdminDrillReviewsController', () => {
  function build() {
    const service = {
      listForReview: jest.fn().mockResolvedValue([]),
      findForReview: jest.fn().mockResolvedValue({ slug: 'a' }),
      decide: jest.fn().mockResolvedValue({ slug: 'a' }),
    };
    return {
      controller: new AdminDrillReviewsController(service as never),
      service,
    };
  }

  it('records the reviewer from the session, not from the body', async () => {
    const { controller, service } = build();
    await controller.approve('staff-7', 'kondition-utan-boll', {
      contentSha256: 'a'.repeat(64),
    });
    expect(service.decide).toHaveBeenCalledWith(
      'staff-7',
      'kondition-utan-boll',
      { status: DrillReviewStatus.APPROVED, contentSha256: 'a'.repeat(64) },
    );
  });

  it('passes the reason through on reject', async () => {
    const { controller, service } = build();
    await controller.reject('staff-7', 'kondition-utan-boll', {
      contentSha256: 'a'.repeat(64),
      reason: 'För svårt.',
    });
    expect(service.decide).toHaveBeenCalledWith(
      'staff-7',
      'kondition-utan-boll',
      {
        status: DrillReviewStatus.REJECTED,
        contentSha256: 'a'.repeat(64),
        reason: 'För svårt.',
      },
    );
  });

  it.each(['../etc/passwd', 'Upper-Case', '', 'a'.repeat(121), 'a b'])(
    'refuses the slug %j before the service sees it',
    async (slug) => {
      const { controller, service } = build();
      await expect(
        controller.approve('staff-7', slug, { contentSha256: 'a'.repeat(64) }),
      ).rejects.toBeInstanceOf(DrillReviewNotFoundException);
      await expect(controller.findOne(slug)).rejects.toBeInstanceOf(
        DrillReviewNotFoundException,
      );
      expect(service.decide).not.toHaveBeenCalled();
      expect(service.findForReview).not.toHaveBeenCalled();
    },
  );
});

describe('drill review DTOs', () => {
  async function errors(cls: new () => object, body: object) {
    return validate(plainToInstance(cls, body));
  }

  it('requires a 64-char hex content hash', async () => {
    expect(await errors(ApproveDrillDto, {})).not.toHaveLength(0);
    expect(
      await errors(ApproveDrillDto, { contentSha256: 'z'.repeat(64) }),
    ).not.toHaveLength(0);
    expect(
      await errors(ApproveDrillDto, { contentSha256: 'a'.repeat(63) }),
    ).not.toHaveLength(0);
    expect(
      await errors(ApproveDrillDto, { contentSha256: 'a'.repeat(64) }),
    ).toHaveLength(0);
  });

  it('requires a reason of 3–300 characters to reject', async () => {
    const sha = 'a'.repeat(64);
    expect(
      await errors(RejectDrillDto, { contentSha256: sha }),
    ).not.toHaveLength(0);
    expect(
      await errors(RejectDrillDto, { contentSha256: sha, reason: 'no' }),
    ).not.toHaveLength(0);
    expect(
      await errors(RejectDrillDto, {
        contentSha256: sha,
        reason: 'x'.repeat(301),
      }),
    ).not.toHaveLength(0);
    expect(
      await errors(RejectDrillDto, {
        contentSha256: sha,
        reason: 'För svårt.',
      }),
    ).toHaveLength(0);
  });
});
