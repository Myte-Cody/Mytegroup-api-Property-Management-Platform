import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as FormData from 'form-data';
import { MemoryStoredFile } from 'nestjs-form-data';
import { firstValueFrom } from 'rxjs';

export interface TranscriptionResponse {
  text: string;
  cost: number;
}

export interface VoiceTicketAnalysisResponse {
  status: 'clarifying' | 'completed';
  response_text: string;
  tickets?: Array<{
    property_name: string;
    unit_number?: string;
    title: string;
    description: string;
    category: string;
    priority: string;
  }>;
  usage_cost: number;
}

@Injectable()
export class VoiceTicketService {
  private readonly logger = new Logger(VoiceTicketService.name);
  private readonly aiEndpoint: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.aiEndpoint = this.configService.get<string>('AI_ENDPOINT') || 'http://localhost:8000';
  }

  /**
   * Transcribe audio file to text using OpenAI Whisper
   */
  async transcribeAudio(audioFile: MemoryStoredFile): Promise<TranscriptionResponse> {
    try {
      const formData = new FormData();
      formData.append('file', audioFile.buffer, {
        filename: audioFile.originalName,
        contentType: audioFile.mimeType,
      });

      this.logger.log(`Transcribing audio file: ${audioFile.originalName}`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiEndpoint}/voice-assistant/transcribe`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000, // 60 seconds timeout for audio processing
        }),
      );

      this.logger.log('Successfully transcribed audio');
      return response.data;
    } catch (error) {
      this.logger.error(`Error transcribing audio: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Analyze transcribed text using GPT-4o to extract maintenance ticket details
   */
  async analyzeMaintenanceDescription(
    transcript: string,
    propertyName?: string,
    unitNumber?: string,
  ): Promise<VoiceTicketAnalysisResponse> {
    try {
      const userContext: any = {};
      if (propertyName) {
        userContext.property_name = propertyName;
      }
      if (unitNumber) {
        userContext.unit_number = unitNumber;
      }

      const payload = {
        messages: [
          {
            role: 'user',
            content: transcript,
          },
        ],
        user_context: userContext,
        image_count: 0,
      };

      this.logger.log('Analyzing maintenance description with AI');

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiEndpoint}/voice-assistant/chat`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        }),
      );

      this.logger.log('Successfully analyzed maintenance description');
      return response.data;
    } catch (error) {
      this.logger.error(`Error analyzing maintenance description: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process voice recording: transcribe and analyze
   */
  async processVoiceTicket(
    audioFile: MemoryStoredFile,
    propertyName?: string,
    unitNumber?: string,
  ): Promise<{
    transcript: string;
    analysis: VoiceTicketAnalysisResponse;
    totalCost: number;
  }> {
    // Step 1: Transcribe audio
    const transcription = await this.transcribeAudio(audioFile);

    // Step 2: Analyze transcribed text
    const analysis = await this.analyzeMaintenanceDescription(
      transcription.text,
      propertyName,
      unitNumber,
    );

    return {
      transcript: transcription.text,
      analysis,
      totalCost: transcription.cost + analysis.usage_cost,
    };
  }
}
