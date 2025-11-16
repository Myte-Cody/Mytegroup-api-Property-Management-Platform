import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AiChatService } from './ai-chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@ApiTags('AI Chat')
@Public()
@Controller('chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  @Throttle({
    default: {
      limit: 10,
      ttl: 60,
    },
  })
  @ApiOperation({
    summary: 'Generic AI chat endpoint with channel routing (public)',
    description:
      'Accepts a short conversation and a channel key, returning an AI reply. Used by the landing-page chatbot and future personas.',
  })
  @ApiBody({ type: ChatRequestDto })
  async chat(@Body() body: ChatRequestDto) {
    const reply = await this.aiChatService.handleChat(body.channel, body.messages ?? [], {
      maxWords: body.maxWords,
      maxOutputTokens: body.maxOutputTokens,
    });
    return { reply };
  }

  @Post('stream')
  @Throttle({
    default: {
      limit: 10,
      ttl: 60,
    },
  })
  @ApiOperation({
    summary: 'Streaming AI chat endpoint with channel routing (public)',
    description:
      'Same contract as POST /chat, but streams the reply body as plain text chunks so the UI can render tokens as they arrive.',
  })
  @ApiBody({ type: ChatRequestDto })
  async chatStream(@Body() body: ChatRequestDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = this.aiChatService.handleChatStream(body.channel, body.messages ?? [], {
      maxWords: body.maxWords,
      maxOutputTokens: body.maxOutputTokens,
    });

    try {
      for await (const chunk of stream) {
        res.write(chunk);
      }
    } catch (error: any) {
      res.write(
        '\n\n[I’m having trouble finishing this reply right now. You can try again in a moment.]',
      );
    } finally {
      res.end();
    }
  }
}
