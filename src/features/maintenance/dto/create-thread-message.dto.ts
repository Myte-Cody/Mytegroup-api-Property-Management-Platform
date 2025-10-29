import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HasMimeType, IsFiles, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { MessageSenderType } from '../schemas/thread-message.schema';

export class CreateThreadMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  content: string;

  @IsNotEmpty()
  @IsEnum(MessageSenderType)
  senderType: MessageSenderType;

  @IsNotEmpty()
  @IsMongoId()
  senderId: string;

  @IsOptional()
  @IsFiles()
  @MaxFileSize(10 * 1024 * 1024, { each: true }) // 10MB per file
  @HasMimeType(['image/*', 'application/pdf'], { each: true })
  media?: MemoryStoredFile[];
}
