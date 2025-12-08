import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { TicketCategory, TicketPriority } from '../../../common/enums/maintenance.enum';

export class CreateTicketDto {
  @ApiProperty({
    description: 'Property ID where the issue is located',
    example: '673d8b8f123456789abcdef0',
  })
  @IsMongoId()
  @IsNotEmpty()
  property: string;

  @ApiProperty({
    description: 'Unit ID where the issue is located',
    example: '673d8b8f123456789abcdef1',
  })
  @IsOptional()
  @IsMongoId()
  unit: string;

  @ApiProperty({
    description: 'Brief title/summary of the maintenance issue',
    example: 'Kitchen faucet is leaking',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the maintenance issue',
    example: 'The kitchen faucet has been dripping constantly for the past week...',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    description: 'Category of the maintenance issue',
    enum: TicketCategory,
    example: TicketCategory.PLUMBING,
  })
  @IsEnum(TicketCategory)
  @IsNotEmpty()
  category: TicketCategory;

  @ApiPropertyOptional({
    description: 'Priority level of the maintenance request',
    enum: TicketPriority,
    example: TicketPriority.MEDIUM,
    default: TicketPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Media files for the maintenance ticket',
    required: false,
  })
  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi'], {
    each: true,
  })
  media_files?: MemoryStoredFile[];

  @ApiPropertyOptional({
    description: 'Additional notes or comments',
    example: 'This started after the recent plumbing work',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Source of the ticket creation',
    example: 'voice',
    enum: ['web', 'mobile', 'voice', 'api'],
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the ticket',
    example: { voiceTranscript: 'The sink is leaking...' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
