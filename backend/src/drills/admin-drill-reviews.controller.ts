import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DrillReviewNotFoundException } from '../common/errors/exceptions';
import { CurrentStaffAccountId } from '../pt/current-staff-account-id.decorator';
import { AdminAuthGuard } from '../staff-auth/guards/admin-auth.guard';
import { DrillLibraryService, DrillReviewView } from './drill-library.service';
import { ApproveDrillDto, RejectDrillDto } from './dto/drill-review.dto';
import { DrillReviewStatus } from './entities/drill-review.entity';

/** A drill slug is a file name the repo chose. Anything else is refused
 *  before it reaches the service, so no caller text is ever stored. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

function assertSlug(slug: string): string {
  if (!SLUG.test(slug)) throw new DrillReviewNotFoundException();
  return slug;
}

/**
 * Staff review of drills whose file says `coachReviewed: false`
 * (ADR-0035's 2026-11-20 amendment; owner decision the same day).
 *
 * The same shape and guard as the tip review queue
 * (AdminTrainerPostsController): `AdminAuthGuard`, class-level, which
 * re-derives admin authority per request from the live `staff_account`
 * row and `ADMIN_EMAILS`. A trainer (`pt`) cannot reach any route here —
 * deciding what enters the library is an operator's call, not an author's.
 * Mutations ride the same `SameSite=Strict` `staff_session` cookie as
 * every other console mutation (ADR-0023 Decision B2).
 *
 * Nothing here writes drill text. A decision is a verdict on a file that
 * already shipped in the image; the text itself only ever changes in git.
 */
@Controller('api/v1/admin/drill-reviews')
@UseGuards(AdminAuthGuard)
export class AdminDrillReviewsController {
  constructor(private readonly drillLibraryService: DrillLibraryService) {}

  /** Every drill needing staff review — pending, approved and rejected. */
  @Get()
  async list(): Promise<DrillReviewView[]> {
    return await this.drillLibraryService.listForReview();
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string): Promise<DrillReviewView> {
    return await this.drillLibraryService.findForReview(assertSlug(slug));
  }

  @Post(':slug/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentStaffAccountId() reviewerStaffAccountId: string,
    @Param('slug') slug: string,
    @Body() dto: ApproveDrillDto,
  ): Promise<DrillReviewView> {
    return await this.drillLibraryService.decide(
      reviewerStaffAccountId,
      assertSlug(slug),
      {
        status: DrillReviewStatus.APPROVED,
        contentSha256: dto.contentSha256,
      },
    );
  }

  /** Also the take-down: rejecting an approved drill hides it at once. */
  @Post(':slug/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentStaffAccountId() reviewerStaffAccountId: string,
    @Param('slug') slug: string,
    @Body() dto: RejectDrillDto,
  ): Promise<DrillReviewView> {
    return await this.drillLibraryService.decide(
      reviewerStaffAccountId,
      assertSlug(slug),
      {
        status: DrillReviewStatus.REJECTED,
        contentSha256: dto.contentSha256,
        reason: dto.reason,
      },
    );
  }
}
