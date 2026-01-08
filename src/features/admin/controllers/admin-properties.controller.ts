import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminPropertiesService } from '../services/admin-properties.service';

@ApiTags('Admin - Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminPropertiesController {
  constructor(private readonly adminPropertiesService: AdminPropertiesService) {}

  @Get('properties')
  @ApiOperation({ summary: 'Get all properties across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Properties retrieved successfully',
  })
  async getProperties(@Query() queryDto: AdminQueryDto) {
    return this.adminPropertiesService.findAllProperties(queryDto);
  }

  @Get('properties/:id')
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Property retrieved successfully',
  })
  async getPropertyById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminPropertiesService.findPropertyById(id);
  }

  @Get('units')
  @ApiOperation({ summary: 'Get all units across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Units retrieved successfully',
  })
  async getUnits(@Query() queryDto: AdminQueryDto) {
    return this.adminPropertiesService.findAllUnits(queryDto);
  }

  @Get('units/:id')
  @ApiOperation({ summary: 'Get unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Unit retrieved successfully',
  })
  async getUnitById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminPropertiesService.findUnitById(id);
  }
}
