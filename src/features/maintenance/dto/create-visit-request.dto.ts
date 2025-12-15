import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { VisitRequestSourceType } from '../schemas/visit-request.schema';

export class CreateVisitRequestDto {
  @ApiProperty({
    description: 'Source type of the visit request',
    enum: VisitRequestSourceType,
    example: VisitRequestSourceType.TICKET,
  })
  @IsEnum(VisitRequestSourceType)
  @IsNotEmpty()
  sourceType: VisitRequestSourceType;

  @ApiPropertyOptional({
    description: 'Ticket ID (required if sourceType is TICKET)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Scope of Work ID (required if sourceType is SCOPE_OF_WORK)',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId()
  scopeOfWorkId?: string;

  @ApiProperty({
    description: 'Availability slot ID the contractor is requesting',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  @IsNotEmpty()
  availabilitySlotId: string;

  @ApiProperty({
    description: 'The specific date for the visit',
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
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format (24-hour)',
    example: '17:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Optional message describing the purpose of the visit',
    example: 'Need to inspect the plumbing issue and take measurements',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Full name (required for MARKETPLACE source)',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Email address (required for MARKETPLACE source)',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number (required for MARKETPLACE source)',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
}
