import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import { AiExtractionService } from '../services/ai-extraction.service';

@ApiTags('ai-extraction')
@ApiBearerAuth()
@Controller('ai-extraction')
@UseGuards(CaslGuard)
export class AiExtractionController {
  constructor(private readonly aiExtractionService: AiExtractionService) {}

  @Post('extract-invoice-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Extract invoice/expense data from uploaded file' })
  @ApiResponse({
    status: 200,
    description: 'Data extracted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            expense_class: { type: 'string', nullable: true },
            invoice_number: { type: 'string', nullable: true },
            total_amount: { type: 'number', nullable: true },
            currency: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - No file provided' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async extractInvoiceData(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!validTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF and image files are allowed.');
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Transform to the format expected by AiExtractionService
    const fileData = {
      buffer: file.buffer,
      originalName: file.originalname,
      busBoyMimeType: file.mimetype,
    };

    const extractedData = await this.aiExtractionService.extractInvoiceData(fileData);

    return {
      success: true,
      data: extractedData,
    };
  }
}
