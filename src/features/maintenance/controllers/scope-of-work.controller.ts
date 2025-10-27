import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateInvoicePolicyHandler,
  DeleteInvoicePolicyHandler,
  ReadInvoicePolicyHandler,
  UpdateInvoicePolicyHandler,
} from '../../../common/casl/policies/invoice.policies';
import {
  CreateScopeOfWorkPolicyHandler,
  DeleteScopeOfWorkPolicyHandler,
  ReadScopeOfWorkPolicyHandler,
  UpdateScopeOfWorkPolicyHandler,
} from '../../../common/casl/policies/scope-of-work.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/schemas/user.schema';
import { AcceptSowDto } from '../dto/accept-sow.dto';
import { AddTicketSowDto } from '../dto/add-ticket-sow.dto';
import { AssignContractorSowDto } from '../dto/assign-contractor-sow.dto';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { CreateScopeOfWorkDto } from '../dto/create-scope-of-work.dto';
import { RefuseSowDto } from '../dto/refuse-sow.dto';
import { RemoveTicketSowDto } from '../dto/remove-ticket-sow.dto';
import { ScopeOfWorkQueryDto } from '../dto/scope-of-work-query.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { InvoicesService } from '../services/invoices.service';
import { ScopeOfWorkService } from '../services/scope-of-work.service';

@ApiTags('Scope of Work')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('maintenance/scope-of-work')
export class ScopeOfWorkController {
  constructor(
    private readonly scopeOfWorkService: ScopeOfWorkService,
    private readonly invoicesService: InvoicesService,
  ) {}

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
  @ApiOperation({ summary: 'Get all scopes of work with pagination' })
  @ApiResponse({ status: 200, description: 'Scopes of work retrieved successfully' })
  async findAll(@Query() queryDto: ScopeOfWorkQueryDto, @CurrentUser() user: User) {
    return this.scopeOfWorkService.findAllPaginated(queryDto, user);
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

  @Post(':id/assign')
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
    console.log(assignDto);
    return this.scopeOfWorkService.assignContractor(id, assignDto, user);
  }

  @Post(':id/tickets/add')
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

  @Post(':id/tickets/remove')
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

  @Post(':id/accept')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Accept a scope of work and assign a user' })
  @ApiResponse({ status: 200, description: 'Scope of work accepted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work or user not found' })
  async accept(
    @Param('id') id: string,
    @Body() acceptDto: AcceptSowDto,
    @CurrentUser() user: User,
  ) {
    return this.scopeOfWorkService.acceptSow(id, acceptDto, user);
  }

  @Post(':id/refuse')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Refuse a scope of work' })
  @ApiResponse({ status: 200, description: 'Scope of work refused successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async refuse(
    @Param('id') id: string,
    @Body() refuseDto: RefuseSowDto,
    @CurrentUser() user: User,
  ) {
    return this.scopeOfWorkService.refuseSow(id, refuseDto, user);
  }

  @Post(':id/close')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Close a scope of work' })
  @ApiResponse({ status: 200, description: 'Scope of work closed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot close: not all tickets are done/closed or not all child SOWs are closed',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async close(@Param('id') id: string, @CurrentUser() user: User) {
    return this.scopeOfWorkService.closeSow(id, user);
  }

  @Post(':id/mark-in-review')
  @CheckPolicies(new UpdateScopeOfWorkPolicyHandler())
  @ApiOperation({ summary: 'Mark a scope of work as in review' })
  @ApiResponse({ status: 200, description: 'Scope of work marked as in review successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot mark parent SOW as in review. Please update the sub SOWs instead.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async markInReview(@Param('id') id: string, @CurrentUser() user: User) {
    return this.scopeOfWorkService.markInReview(id, user);
  }

  @Post(':id/invoices')
  @CheckPolicies(new CreateInvoicePolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add an invoice to a scope of work' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords and contractors' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async addInvoice(
    @Param('id') sowId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.createInvoiceForScopeOfWork(sowId, createInvoiceDto, user);
  }

  @Get(':id/invoices')
  @CheckPolicies(new ReadInvoicePolicyHandler())
  @ApiOperation({ summary: 'Get all invoices for a scope of work' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords and contractors' })
  @ApiResponse({ status: 404, description: 'Scope of work not found' })
  async getScopeOfWorkInvoices(@Param('id') sowId: string, @CurrentUser() user: User) {
    return this.invoicesService.getInvoicesByScopeOfWork(sowId);
  }

  @Patch(':sowId/invoices/:invoiceId')
  @CheckPolicies(new UpdateInvoicePolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an invoice for a scope of work' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can update invoices' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async updateScopeOfWorkInvoice(
    @Param('sowId') sowId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    // Verify scope of work exists
    await this.scopeOfWorkService.findOne(sowId, user);
    return this.invoicesService.updateInvoice(invoiceId, updateInvoiceDto, user);
  }

  @Delete(':sowId/invoices/:invoiceId')
  @CheckPolicies(new DeleteInvoicePolicyHandler())
  @ApiOperation({ summary: 'Delete an invoice from a scope of work' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async deleteScopeOfWorkInvoice(
    @Param('sowId') sowId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: User,
  ) {
    // Verify scope of work exists
    await this.scopeOfWorkService.findOne(sowId, user);
    return this.invoicesService.deleteInvoice(invoiceId, user);
  }
}
