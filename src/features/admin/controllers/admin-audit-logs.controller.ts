import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminAuditLogQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminAuditLogsService } from '../services/admin-audit-logs.service';

@ApiTags('Admin - Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminAuditLogsController {
  constructor(private readonly adminAuditLogsService: AdminAuditLogsService) {}

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get all audit logs (system events)' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  async getAuditLogs(@Query() queryDto: AdminAuditLogQueryDto) {
    return this.adminAuditLogsService.findAllAuditLogs(queryDto);
  }

  @Get('audit-logs/:id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiParam({ name: 'id', description: 'Audit Log ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Audit log retrieved successfully',
  })
  async getAuditLogById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminAuditLogsService.findAuditLogById(id);
  }
}
