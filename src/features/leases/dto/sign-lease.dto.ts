import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignLeaseDto {
  @ApiProperty({
    description: 'Full legal name for signature',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Signature name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(200, { message: 'Name cannot exceed 200 characters' })
  signatureName: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded signature image data',
  })
  @IsString()
  @IsOptional()
  signatureData?: string;

  @ApiProperty({
    description: 'Acknowledgment that tenant has read and agrees to terms',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  agreedToTerms: boolean;
}
