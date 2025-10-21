import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateScopeOfWorkPolicyHandler,
  DeleteScopeOfWorkPolicyHandler,
  ReadScopeOfWorkPolicyHandler,
  UpdateScopeOfWorkPolicyHandler,
} from '../../../common/casl/policies/scope-of-work.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/schemas/user.schema';
import { CreateScopeOfWorkDto } from '../dto/create-scope-of-work.dto';
import { AssignContractorSowDto } from '../dto/assign-contractor-sow.dto';
import { AddTicketSowDto } from '../dto/add-ticket-sow.dto';
import { RemoveTicketSowDto } from '../dto/remove-ticket-sow.dto';
import { ScopeOfWorkService } from '../services/scope-of-work.service';

@ApiTags('Scope of Work')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('maintenance/scope-of-work')
export class ScopeOfWorkController {
  constructor(private readonly scopeOfWorkService: ScopeOfWorkService) {}

  @Post()
  @CheckPolicies(new CreateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Create a new scope of work' })
  @ApiResponse({ status: 201, description: 'Scope of work created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createDto: CreateScopeOfWorkDto, @CurrentUser() user: User) {
    return this.scopeOfWorkService.create(createDto, user);
  }

  @Get()
  @CheckPolicies(new ReadScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Get all scopes of work' })
  @ApiResponse({ status: 200, description: 'Scopes of work retrieved successfully' })
  async findAll(@CurrentUser() user: User) {
    return this.scopeOfWorkService.findAll(user);
  }

  @Get(':id')
  @CheckPolicies(new ReadScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Get a specific scope of work by ID' })
  @ApiResponse({ status: 200, description: 'Scope of work found' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.scopeOfWorkService.findOne(id, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Delete a scope of work' })
  @ApiResponse({ status: 200, description: 'Scope of work deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.scopeOfWorkService.remove(id, user);
  }

  @Patch(':id/assign')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Assign a contractor to a scope of work' })
  @ApiResponse({ status: 200, description: 'Contractor assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async assignContractor(
    @Param('id') id: string,
    @Body() assignDto: AssignContractorSowDto,
    @CurrentUser() user: User,
  ) {
    return this.scopeOfWorkService.assignContractor(id, assignDto, user);
  }

  @Patch(':id/tickets/add')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Add a ticket to a scope of work' })
  @ApiResponse({ status: 200, description: 'Ticket added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work or ticket not found' })
  async addTicket(
    @Param('id') id: string,
    @Body() addTicketDto: AddTicketSowDto,
    @CurrentUser() user: User,
  ) {
    return this.scopeOfWorkService.addTicket(id, addTicketDto, user);
  }

  @Patch(':id/tickets/remove')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Remove a ticket from a scope of work' })
  @ApiResponse({ status: 200, description: 'Ticket removed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work or ticket not found' })
  async removeTicket(
    @Param('id') id: string,
    @Body() removeTicketDto: RemoveTicketSowDto,
    @CurrentUser() user: User,
  ) {
    return this.scopeOfWorkService.removeTicket(id, removeTicketDto, user);
  }
}
