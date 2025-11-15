import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InquiryType } from '../../../common/enums/inquiry.enum';

export class CreateInquiryDto {
  @ApiProperty({
    example: InquiryType.VISIT,
    description: 'Type of inquiry',
    enum: InquiryType,
  })
  @IsEnum(InquiryType)
  @IsNotEmpty()
  inquiryType: InquiryType;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the person making the inquiry',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

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

  @ApiProperty({
    example: 'I would like to schedule a visit to see the property.',
    description: 'Message content',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    example: '2025-11-15',
    description: 'Preferred date for visit or contact',
  })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;
}
