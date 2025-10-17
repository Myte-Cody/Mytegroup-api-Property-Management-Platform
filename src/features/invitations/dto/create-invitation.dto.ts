import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { EntityType } from '../schemas/invitation.schema';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Type of entity to invite',
    enum: EntityType,
    example: EntityType.TENANT,
  })
  @IsNotEmpty()
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Entity-specific data (optional)',
    type: 'object',
    additionalProperties: true,
    example: {},
    default: {},
  })
  @IsOptional()
  @IsObject()
  entityData?: {
    [key: string]: any;
  };
}
