import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsFile, HasMimeType, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';

export class CreatePropertyDto {
  @ApiProperty({
    example: 'Sunset Apartments',
    description: 'Name of the property',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @ApiProperty({ example: '123 Main St', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'New York', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'NY', description: 'State or province' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '10001', description: 'Postal or ZIP code' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'USA', description: 'Country name' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({
    example: 'A beautiful property with mountain views',
    description: 'Description of the property',
    maxLength: 1024,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Media files for the property',
    required: false,
  })
  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi'], { each: true })
  media_files?: MemoryStoredFile[];

  // Getter for backward compatibility with existing code that expects nested address
  get address() {
    return {
      street: this.street,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      country: this.country
    };
  }
}