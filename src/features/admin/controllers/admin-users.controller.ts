import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminQueryDto, AdminUserQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminUsersService } from '../services/admin-users.service';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async getUsers(@Query() queryDto: AdminUserQueryDto) {
    return this.adminUsersService.findAllUsers(queryDto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  async getUserById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminUsersService.findUserById(id);
  }

  @Get('landlords')
  @ApiOperation({ summary: 'Get all landlord organizations' })
  @ApiResponse({
    status: 200,
    description: 'Landlords retrieved successfully',
  })
  async getLandlords(@Query() queryDto: AdminQueryDto) {
    return this.adminUsersService.findAllLandlords(queryDto);
  }

  @Get('landlords/:id')
  @ApiOperation({ summary: 'Get landlord by ID with associated users and stats' })
  @ApiParam({ name: 'id', description: 'Landlord ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Landlord retrieved successfully',
  })
  async getLandlordById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminUsersService.findLandlordById(id);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenant organizations' })
  @ApiResponse({
    status: 200,
    description: 'Tenants retrieved successfully',
  })
  async getTenants(@Query() queryDto: AdminQueryDto) {
    return this.adminUsersService.findAllTenants(queryDto);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant by ID with associated users' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Tenant retrieved successfully',
  })
  async getTenantById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminUsersService.findTenantById(id);
  }

  @Get('contractors')
  @ApiOperation({ summary: 'Get all contractor organizations' })
  @ApiResponse({
    status: 200,
    description: 'Contractors retrieved successfully',
  })
  async getContractors(@Query() queryDto: AdminQueryDto) {
    return this.adminUsersService.findAllContractors(queryDto);
  }

  @Get('contractors/:id')
  @ApiOperation({ summary: 'Get contractor by ID with associated users' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Contractor retrieved successfully',
  })
  async getContractorById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminUsersService.findContractorById(id);
  }
}
