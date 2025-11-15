import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';

export class MarkDoneTicketDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Media files for the ticket work proof',
    required: false,
  })
  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi'], {
    each: true,
  })
  media_files?: MemoryStoredFile[];
}
