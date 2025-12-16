import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({
    example: '673d8b8f123456789abcdef1',
    description: 'ID of the unit to add to favorites',
  })
  @IsMongoId()
  @IsNotEmpty()
  unitId: string;
}
