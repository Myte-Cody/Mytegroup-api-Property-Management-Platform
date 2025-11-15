import { ApiProperty } from '@nestjs/swagger';

export class OnboardingStateDto {
  @ApiProperty()
  hasProperties: boolean;

  @ApiProperty()
  hasUnits: boolean;

  @ApiProperty()
  hasTenants: boolean;

  @ApiProperty()
  hasContractors: boolean;

  @ApiProperty()
  hasTickets: boolean;
}

