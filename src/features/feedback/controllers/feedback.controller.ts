import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { FeedbackService } from '../services/feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async createFeedback(@CurrentUser() user: User, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.createFeedback(user, dto);
  }

  @Get()
  async listFeedback(@CurrentUser() user: User, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.feedbackService.listFeedback(user._id.toString(), parsedLimit);
  }

  @Get(':id')
  async getFeedback(@CurrentUser() user: User, @Param('id') id: string) {
    return this.feedbackService.getFeedbackById(id, user._id.toString());
  }
}
