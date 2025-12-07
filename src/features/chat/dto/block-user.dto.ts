import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class BlockUserDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'The ID of the user to block',
  })
  @IsMongoId()
  userId: Types.ObjectId;
}
