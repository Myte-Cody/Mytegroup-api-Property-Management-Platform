import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';

// Custom validator that handles MIME types with codec information
function IsAudioFile(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAudioFile',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value || !value.busBoyMimeType) {
            return false;
          }
          const mimeType = value.busBoyMimeType.toLowerCase();
          const acceptedTypes = [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/m4a',
            'audio/x-m4a',
            'audio/webm',
            'audio/ogg',
          ];
          // Check if MIME type starts with any accepted type (handles codec info)
          return acceptedTypes.some((type) => mimeType.startsWith(type));
        },
        defaultMessage() {
          return 'File must be an audio file (mpeg, mp3, wav, m4a, webm, or ogg)';
        },
      },
    });
  };
}

export class CreateVoiceTicketDto {
  @ApiProperty({
    description: 'Property ID where the maintenance issue is located',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  property: string;

  @ApiProperty({
    description: 'Unit ID (optional, for unit-specific issues)',
    example: '507f1f77bcf86cd799439012',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiProperty({
    description: 'Audio file containing voice description of the issue',
    type: 'string',
    format: 'binary',
  })
  @IsFile()
  @MaxFileSize(10e6) // 10MB
  @IsAudioFile({
    message: 'File must be an audio file (mpeg, mp3, wav, m4a, webm, or ogg)',
  })
  audio_file: MemoryStoredFile;

  @ApiProperty({
    description: 'Property name for context (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  property_name?: string;

  @ApiProperty({
    description: 'Unit number for context (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  unit_number?: string;
}
