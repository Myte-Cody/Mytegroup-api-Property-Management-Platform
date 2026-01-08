import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminLeaseQueryDto, AdminTransactionQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminLeasesService } from '../services/admin-leases.service';

@ApiTags('Admin - Leases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminLeasesController {
  constructor(private readonly adminLeasesService: AdminLeasesService) {}

  @Get('leases')
  @ApiOperation({ summary: 'Get all leases across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Leases retrieved successfully',
  })
  async getLeases(@Query() queryDto: AdminLeaseQueryDto) {
    return this.adminLeasesService.findAllLeases(queryDto);
  }

  @Get('leases/:id')
  @ApiOperation({ summary: 'Get lease by ID' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lease retrieved successfully',
  })
  async getLeaseById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminLeasesService.findLeaseById(id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all transactions/payments across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  async getTransactions(@Query() queryDto: AdminTransactionQueryDto) {
    return this.adminLeasesService.findAllTransactions(queryDto);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
  })
  async getTransactionById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminLeasesService.findTransactionById(id);
  }
}
