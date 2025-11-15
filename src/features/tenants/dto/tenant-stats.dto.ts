import { ApiProperty } from '@nestjs/swagger';

export class TenantStatsDto {
  @ApiProperty({
    description: 'Number of active leases for the tenant',
    example: 2,
  })
  activeLeases: number;

  @ApiProperty({
    description: 'Total monthly rent amount from all active leases',
    example: 2500.0,
  })
  totalMonthlyRent: number;

  @ApiProperty({
    description: 'Total outstanding amount from overdue transactions',
    example: 850.0,
  })
  outstanding: number;

  @ApiProperty({
    description: 'Date of the nearest lease expiry among active leases',
    example: '2024-12-31T00:00:00Z',
    type: Date,
    nullable: true,
  })
  nextExpiry: Date | null;
}
