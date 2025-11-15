import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  OccupancyLeasingKPIQueryDto,
  OccupancyLeasingKPIResponseDto,
} from '../dto/occupancy-leasing-kpi.dto';
import { OccupancyLeasingKPIService } from '../services/occupancy-leasing-kpi.service';

@ApiTags('KPI')
@ApiBearerAuth()
@Controller('kpi/occupancy-leasing')
@UseGuards(JwtAuthGuard)
export class OccupancyLeasingKPIController {
  constructor(private readonly occupancyLeasingKPIService: OccupancyLeasingKPIService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Occupancy & Leasing KPIs',
    description: `
      Retrieve comprehensive occupancy and leasing metrics including:

      **Occupancy & Utilization:**
      - Occupancy Rate (%)
      - Vacancy Rate (%)
      - Average Occupancy Duration (days)
      - Occupancy Growth Rate (%) - when comparison is enabled

      **Leasing Activity:**
      - New Leases Signed
      - Terminated Leases
      - Lease Renewal Rate (%)
      - Average Vacancy Duration (days)
      - Turnover Rate (%)

      **Available Filters:**
      - **Scope**: Portfolio (all properties) or Property (specific property)
      - **Property Selector**: Required when scope is "property"
      - **Tenant Selector**: Optional filter for specific tenant
      - **Period**: This Month / Last Month / Year to Date / Rolling 12 Months / Custom Range
      - **Compare Toggle**: Enable/disable comparison with previous period
    `,
  })
  async getOccupancyLeasingKPIs(
    @Query() query: OccupancyLeasingKPIQueryDto,
  ): Promise<OccupancyLeasingKPIResponseDto> {
    return this.occupancyLeasingKPIService.getOccupancyLeasingKPIs(query);
  }
}
