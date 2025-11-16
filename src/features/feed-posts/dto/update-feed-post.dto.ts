import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { CreatePollDto } from './create-poll.dto';

export class UpdateFeedPostDto {
  @ApiPropertyOptional({
    description: 'Post title',
    example: 'Updated Announcement',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Post description (rich text)',
    example: '<p>Updated announcement text...</p>',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Poll data',
    type: CreatePollDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Media file for the post (image only)',
  })
  @IsOptional()
  @IsFile()
  @MaxFileSize(10 * 1024 * 1024) // 10MB
  @HasMimeType(['image/jpeg', 'image/png', 'image/jpg', 'image/gif'])
  media_file?: MemoryStoredFile;
}
