import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { MediaType } from '../../media/schemas/media.schema';

export class UploadMediaDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File to upload',
  })
  @IsFile()
  @MaxFileSize(50 * 1024 * 1024) // 50MB
  @HasMimeType([
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])
  file: MemoryStoredFile;

  @ApiProperty({
    description: 'Media type',
    enum: MediaType,
    required: false,
  })
  @IsOptional()
  @IsString()
  media_type?: MediaType;

  @ApiProperty({
    description: 'Custom name for the media',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Collection name for grouping media',
    required: false,
  })
  @IsOptional()
  @IsString()
  collection_name?: string;
}
