import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { InquiryType } from '../../../common/enums/inquiry.enum';

export class UpdateInquiryDto {
  @ApiPropertyOptional({
    example: InquiryType.CONTACT,
    description: 'Type of inquiry',
    enum: InquiryType,
  })
  @IsOptional()
  @IsEnum(InquiryType)
  inquiryType?: InquiryType;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Name of the person making the inquiry',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'john.doe@example.com',
    description: 'Email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: '673d8b8f123456789abcdef0',
    description: 'ID of the property of interest',
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    example: '673d8b8f123456789abcdef1',
    description: 'ID of the unit of interest',
  })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({
    example: 'I would like to schedule a visit to see the property.',
    description: 'Message content',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    example: '2025-11-15',
    description: 'Preferred date for visit or contact',
  })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;
}
