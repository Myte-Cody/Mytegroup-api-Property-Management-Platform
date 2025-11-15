import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FeedbackMessageRole, FeedbackPriority } from '../schemas/feedback.schema';

export class FeedbackMessageDto {
  @IsEnum(FeedbackMessageRole)
  role: FeedbackMessageRole;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsDateString()
  timestamp: string;
}

export class CreateFeedbackDto {
  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedbackMessageDto)
  conversation: FeedbackMessageDto[];
}
