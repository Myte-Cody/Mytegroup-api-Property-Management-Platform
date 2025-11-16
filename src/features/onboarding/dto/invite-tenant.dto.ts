import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class InviteTenantDto {
  @ApiProperty({ example: 'futuretenant@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Property ID the tenant will be associated with' })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Unit ID (optional)' })
  @IsOptional()
  @IsMongoId()
  unitId?: string;
}
