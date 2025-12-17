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

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number (optional)',
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

/**
 * DTO for creating a contact inquiry (public, requires email verification for unauthenticated users)
 * For authenticated tenants, name and email are optional (will be taken from user profile)
 */
export class CreateContactInquiryDto {
  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Full name (optional for authenticated tenants)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'john.doe@example.com',
    description: 'Email address (optional for authenticated tenants)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '673d8b8f123456789abcdef1',
    description: 'ID of the unit of interest',
  })
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({
    example: 'I am interested in this property. Is it still available?',
    description: 'Message content',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

/**
 * DTO for verifying email and submitting the inquiry
 */
export class VerifyContactInquiryDto {
  @ApiProperty({
    example: '673d8b8f123456789abcdef0',
    description: 'ID of the inquiry to verify',
  })
  @IsString()
  @IsNotEmpty()
  inquiryId: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code sent to email',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

/**
 * DTO for landlord replying to an inquiry
 */
export class ReplyToInquiryDto {
  @ApiProperty({
    example:
      'Thank you for your interest! The unit is still available. Would you like to schedule a viewing?',
    description: 'Reply message to send to the inquirer',
  })
  @IsString()
  @IsNotEmpty()
  reply: string;
}
