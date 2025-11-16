import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MarketingChatRequestDto } from './dto/marketing-chat-request.dto';
import { MarketingChatService } from './marketing-chat.service';

@ApiTags('Marketing Chat')
@Public()
@Controller('marketing-chat')
export class MarketingChatController {
  constructor(private readonly marketingChatService: MarketingChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Landing-page marketing chatbot (public, unauthenticated)',
    description:
      'Accepts a short conversation and returns a MYTE Estates reply focused on real-estate workflows and the Myte platform.',
  })
  @ApiBody({ type: MarketingChatRequestDto })
  async chat(@Body() body: MarketingChatRequestDto) {
    const reply = await this.marketingChatService.generateReply(body.messages ?? []);
    return { reply };
  }
}
