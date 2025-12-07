import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class ClearChatHistoryDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'The ID of the thread to clear chat history for',
  })
  @IsMongoId()
  threadId: Types.ObjectId;
}
