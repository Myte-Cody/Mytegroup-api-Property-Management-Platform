import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HasMimeType, IsFiles, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsFiles()
  @MaxFileSize(10 * 1024 * 1024, { each: true }) // 10MB per file
  @HasMimeType(['image/*', 'application/pdf'], { each: true })
  media?: MemoryStoredFile[];
}
