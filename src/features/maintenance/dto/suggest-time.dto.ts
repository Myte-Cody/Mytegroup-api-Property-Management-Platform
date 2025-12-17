import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SuggestTimeDto {
  @ApiPropertyOptional({
    description: 'Availability slot ID (optional, can be null for custom times)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId()
  availabilitySlotId?: string;

  @ApiProperty({
    description: 'The suggested date for the visit',
    example: '2024-03-15',
  })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  visitDate: Date;

  @ApiProperty({
    description: 'Start time in HH:mm format (24-hour)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (24-hour)',
  })
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format (24-hour)',
    example: '17:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({
    description: 'Reason for suggesting a different time',
    example: "The original time doesn't work for me. Would this alternative work better?",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rescheduleReason?: string;
}
