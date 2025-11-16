import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AcceptSowDto {
  @ApiProperty({
    description: 'User ID to assign the SOW to',
    example: '673d8b8f123456789abcdef3',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}
