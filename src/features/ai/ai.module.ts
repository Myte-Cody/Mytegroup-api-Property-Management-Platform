import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiExtractionService } from './services/ai-extraction.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [AiExtractionService],
  exports: [AiExtractionService],
})
export class AiModule {}
