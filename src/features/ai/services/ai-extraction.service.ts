import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as FormData from 'form-data';
import { firstValueFrom } from 'rxjs';

export interface InvoiceExtractionResult {
  expense_class?: string;
  invoice_number?: string;
  total_amount?: number;
  currency?: string;
}

@Injectable()
export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);
  private readonly aiEndpoint: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.aiEndpoint = this.configService.get<string>('AI_ENDPOINT') || 'http://localhost:8000';
  }

  /**
   * Extract expense information from a file (image or PDF)
   */
  async extractInvoiceData(file: any): Promise<InvoiceExtractionResult> {
    try {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalName,
        contentType: file.busBoyMimeType,
      });
      this.logger.log(`Extracting expense data from file: ${file.originalName}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiEndpoint}/invoice-classifier/parse-and-classify-invoice`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            timeout: 30000, // 30 seconds timeout
          },
        ),
      );

      this.logger.log('Successfully extracted expense data');
      return response.data;
    } catch (error) {
      this.logger.error(`Error extracting expense data: ${error.message}`, error.stack);
      // Return empty object if extraction fails - don't block expense creation
      return {};
    }
  }
}
