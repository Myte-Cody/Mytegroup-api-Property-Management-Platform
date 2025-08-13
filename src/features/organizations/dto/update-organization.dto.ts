import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrganizationType } from '../../../common/enums/organization.enum';
import { ApiProperty } from '@nestjs/swagger';
import { TransformToLowercase } from '../../../common/decorators/transform-to-lowercase.decorator';

export class UpdateOrganizationDto {
  @ApiProperty({
    example: 'Acme Property Management',
    description: 'Organization name (will be stored as lowercase)',
    maxLength: 128,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @TransformToLowercase()
  name?: string;

  @ApiProperty({
    example: 'PROPERTY_MANAGER',
    description: 'Type of organization',
    enum: OrganizationType,
    enumName: 'OrganizationType',
    required: false,
  })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
}
