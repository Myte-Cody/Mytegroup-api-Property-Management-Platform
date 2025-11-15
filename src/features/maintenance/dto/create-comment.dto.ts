import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Content of the comment',
    example: 'I have started working on this issue and will need to order parts.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Media files for the comment',
    required: false,
  })
  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(
    [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/avi',
      'application/pdf',
    ],
    {
      each: true,
    },
  )
  media_files?: MemoryStoredFile[];
}
