import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminMaintenanceQueryDto, AdminQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminMaintenanceService } from '../services/admin-maintenance.service';

@ApiTags('Admin - Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminMaintenanceController {
  constructor(private readonly adminMaintenanceService: AdminMaintenanceService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Get all maintenance tickets across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Tickets retrieved successfully',
  })
  async getTickets(@Query() queryDto: AdminMaintenanceQueryDto) {
    return this.adminMaintenanceService.findAllTickets(queryDto);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get maintenance ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Ticket retrieved successfully',
  })
  async getTicketById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminMaintenanceService.findTicketById(id);
  }

  @Get('sows')
  @ApiOperation({ summary: 'Get all scope of works across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'SOWs retrieved successfully',
  })
  async getSows(@Query() queryDto: AdminMaintenanceQueryDto) {
    return this.adminMaintenanceService.findAllSows(queryDto);
  }

  @Get('sows/:id')
  @ApiOperation({ summary: 'Get scope of work by ID' })
  @ApiParam({ name: 'id', description: 'SOW ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'SOW retrieved successfully',
  })
  async getSowById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminMaintenanceService.findSowById(id);
  }

  @Get('visit-requests')
  @ApiOperation({ summary: 'Get all visit requests across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Visit requests retrieved successfully',
  })
  async getVisitRequests(@Query() queryDto: AdminQueryDto) {
    return this.adminMaintenanceService.findAllVisitRequests(queryDto);
  }

  @Get('visit-requests/:id')
  @ApiOperation({ summary: 'Get visit request by ID' })
  @ApiParam({ name: 'id', description: 'Visit Request ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Visit request retrieved successfully',
  })
  async getVisitRequestById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminMaintenanceService.findVisitRequestById(id);
  }
}
