import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { LandingChatFeedbackDto } from '../dto/landing-chat-feedback.dto';
import { LandingChatFeedbackService } from '../services/landing-chat-feedback.service';

@ApiTags('Landing Feedback')
@Public()
@Controller('feedback/landing')
export class LandingFeedbackController {
  constructor(private readonly landingFeedbackService: LandingChatFeedbackService) {}

  @Post('auto')
  @ApiOperation({
    summary: 'Capture landing-page chat feedback (public)',
    description:
      'Takes a short landing chat transcript plus an email address, classifies it with GPT-4.1, stores it under the subscribers collection, and sends confirmation emails to both the team and the user.',
  })
  @ApiBody({ type: LandingChatFeedbackDto })
  async createFromChat(@Body() dto: LandingChatFeedbackDto) {
    await this.landingFeedbackService.handleLandingFeedback(dto);
    return {
      status: 'ok',
      message:
        'Thanks for sharing your feedback. We are processing it in the background and will factor it into how we shape MYTE Estates.',
    };
  }
}
