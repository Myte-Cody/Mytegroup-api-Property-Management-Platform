import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantTableViewDto {
  @ApiProperty({ description: 'Tenant ID' })
  _id: string;

  @ApiProperty({ description: 'Tenant name' })
  name: string;

  @ApiPropertyOptional({ description: 'Primary user email (from users collection)' })
  email?: string;

  @ApiPropertyOptional({ description: 'Primary user phone (from users collection)' })
  phone?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Number of active leases', example: 2 })
  activeLeasesCount: number;

  @ApiProperty({ description: 'Whether tenant has active leases', example: true })
  hasActiveLeases: boolean;

  @ApiProperty({
    description: 'Total outstanding balance from overdue transactions',
    example: 2500,
  })
  outstandingBalance: number;
}
