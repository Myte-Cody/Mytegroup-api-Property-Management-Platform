import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  MaintenanceCostInvoicingKPIResponseDto,
  MaintenanceKPIQueryDto,
  MaintenanceKPIResponseDto,
  ResolutionCompletionKPIResponseDto,
  TicketWorkVolumeKPIResponseDto,
} from '../dto/maintenance-kpi.dto';
import { MaintenanceKPIService } from '../services/maintenance-kpi.service';

@ApiTags('KPI')
@ApiBearerAuth()
@Controller('kpi/maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceKPIController {
  constructor(private readonly maintenanceKPIService: MaintenanceKPIService) {}

  @Get()
  @ApiOperation({ summary: 'Get maintenance and operations KPIs' })
  async getMaintenanceKPIs(
    @Query() query: MaintenanceKPIQueryDto,
  ): Promise<MaintenanceKPIResponseDto> {
    return this.maintenanceKPIService.getMaintenanceKPIs(query);
  }

  @Get('ticket-work-volume')
  @ApiOperation({ summary: 'Get ticket and work volume KPIs' })
  async getTicketWorkVolumeKPIs(
    @Query() query: MaintenanceKPIQueryDto,
  ): Promise<TicketWorkVolumeKPIResponseDto> {
    return this.maintenanceKPIService.getTicketWorkVolumeKPIs(query);
  }

  @Get('cost-invoicing')
  @ApiOperation({ summary: 'Get maintenance cost and invoicing KPIs' })
  async getMaintenanceCostInvoicingKPIs(
    @Query() query: MaintenanceKPIQueryDto,
  ): Promise<MaintenanceCostInvoicingKPIResponseDto> {
    return this.maintenanceKPIService.getMaintenanceCostInvoicingKPIs(query);
  }

  @Get('resolution-completion')
  @ApiOperation({ summary: 'Get resolution and completion KPIs' })
  async getResolutionCompletionKPIs(
    @Query() query: MaintenanceKPIQueryDto,
  ): Promise<ResolutionCompletionKPIResponseDto> {
    return this.maintenanceKPIService.getResolutionCompletionKPIs(query);
  }
}
