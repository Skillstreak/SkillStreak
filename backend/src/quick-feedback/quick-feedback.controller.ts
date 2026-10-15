import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentPlayerId } from '../auth/current-player-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitQuickFeedbackDto } from './dto/submit-quick-feedback.dto';
import { QuickFeedbackService } from './quick-feedback.service';

/** I-002 — player-facing half. The staff totals live in `admin/`. */
@Controller('api/v1/feedback/quick')
export class QuickFeedbackController {
  constructor(private readonly quickFeedbackService: QuickFeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async submit(
    @CurrentPlayerId() playerId: string,
    @Body() dto: SubmitQuickFeedbackDto,
  ): Promise<void> {
    await this.quickFeedbackService.submit(playerId, dto);
  }
}
