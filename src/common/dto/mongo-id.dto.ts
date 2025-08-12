import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsObjectId } from '../decorators/is-object-id.decorator';

export class MongoIdDto {
  @ApiProperty({
    description: 'MongoDB ObjectId',
    example: '60d21b4667d0d8992e610c85',
  })
  @IsNotEmpty()
  @IsObjectId({ message: 'Invalid MongoDB ObjectId format' })
  id: string;
}
