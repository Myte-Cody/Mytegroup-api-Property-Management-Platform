import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminOverviewService } from '../services/admin-overview.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminOverviewController {
  constructor(private readonly adminOverviewService: AdminOverviewService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get admin dashboard overview statistics' })
  @ApiResponse({
    status: 200,
    description: 'Overview statistics retrieved successfully',
  })
  async getOverview() {
    const stats = await this.adminOverviewService.getOverviewStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('landlords-list')
  @ApiOperation({ summary: 'Get list of all landlords for filtering' })
  @ApiResponse({
    status: 200,
    description: 'Landlords list retrieved successfully',
  })
  async getLandlordsList() {
    const landlords = await this.adminOverviewService.getLandlordsList();
    return {
      success: true,
      data: landlords,
    };
  }
}
