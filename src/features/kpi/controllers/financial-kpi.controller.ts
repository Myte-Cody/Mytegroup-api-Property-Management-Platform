import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { FinancialKPIQueryDto, FinancialKPIResponseDto } from '../dto/financial-kpi.dto';
import { FinancialKPIService } from '../services/financial-kpi.service';

@ApiTags('KPI')
@ApiBearerAuth()
@Controller('kpi/financial')
@UseGuards(JwtAuthGuard)
export class FinancialKPIController {
  constructor(private readonly financialKPIService: FinancialKPIService) {}

  @Get()
  @ApiOperation({ summary: 'Get financial KPIs' })
  async getFinancialKPIs(@Query() query: FinancialKPIQueryDto): Promise<FinancialKPIResponseDto> {
    return this.financialKPIService.getFinancialKPIs(query);
  }
}
