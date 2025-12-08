import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsMongoId, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class MuteThreadDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'The ID of the thread to mute',
  })
  @IsMongoId()
  threadId: Types.ObjectId;

  @ApiProperty({
    example: '2025-12-31T23:59:59.000Z',
    description:
      'Optional date until when to mute the thread. If not provided, thread is muted permanently.',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  muteUntil?: Date;
}
