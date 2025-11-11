import { IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  attachments?: string[];
}
