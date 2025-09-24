import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { EntityType, InvitationStatus } from '../schemas/invitation.schema';

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

export class InvitationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search term to filter invitations',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: EntityType,
  })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional({
    description: 'Filter by invitation status',
    enum: InvitationStatus,
  })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
