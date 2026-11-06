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
import { AdultFeedbackService } from './adult-feedback.service';
import { CreateAdultFeedbackDto } from './dto/create-adult-feedback.dto';

/** I-001. Sender identity comes from the session, never the body. */
@Controller('api/v1/adult-feedback')
export class AdultFeedbackController {
  constructor(private readonly adultFeedbackService: AdultFeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  submit(
    @CurrentPlayerId() playerId: string,
    @Body() dto: CreateAdultFeedbackDto,
  ): Promise<{ sent: true }> {
    return this.adultFeedbackService.submit(playerId, dto);
  }
}
