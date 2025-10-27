import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
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
}
