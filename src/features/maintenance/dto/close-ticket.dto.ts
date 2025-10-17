import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CloseTicketDto {
  @ApiProperty({
    description: 'Cost of the maintenance work',
    example: 150.5,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cost?: number;
}
