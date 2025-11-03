import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { CreatePollDto } from './create-poll.dto';

export class CreateFeedPostDto {
  @ApiProperty({
    description: 'Property ID',
    example: '673d8b8f123456789abcdef0',
  })
  @IsMongoId()
  @IsNotEmpty()
  property: string;

  @ApiProperty({
    description: 'Post title',
    example: 'Important Announcement',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Post description (rich text)',
    example: '<p>This is an important announcement for all tenants...</p>',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    description: 'Poll data',
    type: CreatePollDto,
  })
  @IsOptional()
  @Transform(({ value }) => {
    try {
      return plainToInstance(CreatePollDto, JSON.parse(value));
    } catch {
      return value;
    }
  })
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
