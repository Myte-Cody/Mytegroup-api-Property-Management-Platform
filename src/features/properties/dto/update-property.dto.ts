import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';
import { CreatePropertyDto } from './create-property.dto';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiProperty({
    example: '60d21b4667d0d8992e610c85',
    description: 'Organization ID that owns this property',
  })
  @IsMongoId()
  @IsNotEmpty()
  owner: Types.ObjectId;
}
