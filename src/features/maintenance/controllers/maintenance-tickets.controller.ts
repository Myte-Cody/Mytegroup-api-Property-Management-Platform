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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { Action } from '../../../common/casl/casl-ability.factory';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateInvoicePolicyHandler,
  DeleteInvoicePolicyHandler,
  ReadInvoicePolicyHandler,
  UpdateInvoicePolicyHandler,
} from '../../../common/casl/policies/invoice.policies';
import {
  CreateMaintenanceTicketPolicyHandler,
  DeleteMaintenanceTicketPolicyHandler,
  ManageMaintenanceTicketPolicyHandler,
  ReadMaintenanceTicketPolicyHandler,
  UpdateMaintenanceTicketPolicyHandler,
} from '../../../common/casl/policies/maintenance-ticket.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MediaType } from '../../media/schemas/media.schema';
import { MediaService } from '../../media/services/media.service';
import { User } from '../../users/schemas/user.schema';
import {
  AcceptThreadDto,
  AcceptTicketDto,
  AssignTicketDto,
  CreateInvoiceDto,
  CreateThreadMessageDto,
  CreateTicketDto,
  DeclineThreadDto,
  RefuseTicketDto,
  ThreadQueryDto,
  TicketQueryDto,
  UpdateInvoiceDto,
  UpdateTicketDto,
} from '../dto';
import { MarkDoneTicketDto } from '../dto/mark-done-ticket.dto';
import { ThreadMessage } from '../schemas/thread-message.schema';
import { ThreadParticipant } from '../schemas/thread-participant.schema';
import { Thread } from '../schemas/thread.schema';
import { InvoicesService } from '../services/invoices.service';
import { MaintenanceTicketsService } from '../services/maintenance-tickets.service';
import { ThreadsService } from '../services/threads.service';

@ApiTags('Maintenance Tickets')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('maintenance/tickets')
export class MaintenanceTicketsController {
  constructor(
    private readonly ticketsService: MaintenanceTicketsService,
    private readonly invoicesService: InvoicesService,
    private readonly mediaService: MediaService,
    private readonly threadsService: ThreadsService,
  ) {}

  @Post()
  @CheckPolicies(new CreateMaintenanceTicketPolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new maintenance ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createTicketDto: CreateTicketDto, @CurrentUser() user: User) {
    return this.ticketsService.create(createTicketDto, user);
  }

  @Get()
  @CheckPolicies(new ReadMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Get all maintenance tickets with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async findAll(@Query() query: TicketQueryDto, @CurrentUser() user: User) {
    return this.ticketsService.findAllPaginated(query, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Get a specific maintenance ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket found' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.findOne(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Update a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async update(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.update(id, updateTicketDto, user);
  }

  @Post(':id/assign')
  @CheckPolicies(new ManageMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Assign a contractor to a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Only landlords can assign tickets' })
  @ApiResponse({ status: 404, description: 'Ticket or contractor not found' })
  async assign(
    @Param('id') id: string,
    @Body() assignDto: AssignTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.assignTicket(id, assignDto, user);
  }

  @Post(':id/accept')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Accept a maintenance ticket and assign a user' })
  @ApiResponse({ status: 200, description: 'Ticket accepted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket or user not found' })
  async accept(
    @Param('id') id: string,
    @Body() acceptDto: AcceptTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.acceptTicket(id, acceptDto, user);
  }

  @Post(':id/refuse')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Refuse a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket refused successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async refuse(
    @Param('id') id: string,
    @Body() refuseDto: RefuseTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.refuseTicket(id, refuseDto, user);
  }

  @Post(':id/mark-as-done')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mark a maintenance ticket as done' })
  @ApiResponse({ status: 200, description: 'Ticket marked as done successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async markAsDone(
    @Param('id') id: string,
    @Body() markDoneDto: MarkDoneTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.markAsDone(id, markDoneDto, user);
  }

  @Post(':id/close')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Close a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket closed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async close(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.closeTicket(id, user);
  }

  @Post(':id/reopen')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Reopen a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket reopened successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async reopen(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.reopenTicket(id, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Delete a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket deleted successfully' })
  @ApiResponse({ status: 400, description: 'Only open tickets can be deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.remove(id, user);
  }

  @Get(':id/media')
  @CheckPolicies(new ReadMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Get all media for a maintenance ticket' })
  @ApiParam({ name: 'id', description: 'Ticket ID', type: String })
  async getTicketMedia(
    @Param('id') ticketId: string,
    @CurrentUser() user: User,
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    await this.ticketsService.findOne(ticketId, user);

    const media = await this.mediaService.getMediaForEntity(
      'MaintenanceTicket',
      ticketId,
      user,
      collectionName,
      {
        media_type: mediaType,
      },
    );

    return {
      success: true,
      data: media,
    };
  }

  @Post(':id/invoices')
  @CheckPolicies(new CreateInvoicePolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add an invoice to a maintenance ticket' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords and contractors' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async addInvoice(
    @Param('id') ticketId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.createInvoiceForTicket(ticketId, createInvoiceDto, user);
  }

  @Get(':id/invoices')
  @CheckPolicies(new ReadInvoicePolicyHandler())
  @ApiOperation({ summary: 'Get all invoices for a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords and contractors' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketInvoices(@Param('id') ticketId: string, @CurrentUser() user: User) {
    return this.invoicesService.getInvoicesByTicket(ticketId);
  }

  @Patch(':ticketId/invoices/:invoiceId')
  @CheckPolicies(new UpdateInvoicePolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an invoice for a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can update invoices' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async updateTicketInvoice(
    @Param('ticketId') ticketId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    // Verify ticket exists
    await this.ticketsService.findOne(ticketId, user);
    return this.invoicesService.updateInvoice(invoiceId, updateInvoiceDto, user);
  }

  @Delete(':ticketId/invoices/:invoiceId')
  @CheckPolicies(new DeleteInvoicePolicyHandler())
  @ApiOperation({ summary: 'Delete an invoice from a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async deleteTicketInvoice(
    @Param('ticketId') ticketId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: User,
  ) {
    // Verify ticket exists
    await this.ticketsService.findOne(ticketId, user);
    return this.invoicesService.deleteInvoice(invoiceId, user);
  }

  // Thread endpoints

  @Get(':id/threads')
  @CheckPolicies((ability) => ability.can(Action.Read, Thread))
  @ApiOperation({ summary: 'Get all threads for a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Threads retrieved successfully' })
  async getTicketThreads(@Param('id') ticketId: string, @Query() query: ThreadQueryDto) {
    return this.threadsService.findAll({ ...query, linkedEntityId: ticketId });
  }

  @Get(':ticketId/threads/:threadId')
  @CheckPolicies((ability) => ability.can(Action.Read, Thread))
  @ApiOperation({ summary: 'Get a specific thread by ID' })
  @ApiResponse({ status: 200, description: 'Thread found' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async getThread(@Param('threadId') threadId: string) {
    return this.threadsService.findOne(threadId);
  }

  @Get(':ticketId/threads/:threadId/participants')
  @CheckPolicies((ability) => ability.can(Action.Read, ThreadParticipant))
  @ApiOperation({ summary: 'Get all participants for a thread' })
  @ApiResponse({ status: 200, description: 'Participants retrieved successfully' })
  async getThreadParticipants(@Param('threadId') threadId: string) {
    return this.threadsService.getParticipants(threadId);
  }

  @Post(':ticketId/threads/:threadId/accept')
  @CheckPolicies((ability) => ability.can(Action.Update, ThreadParticipant))
  @ApiOperation({ summary: 'Accept a thread invitation' })
  @ApiResponse({ status: 200, description: 'Thread accepted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async acceptThread(@Param('threadId') threadId: string, @Body() acceptDto: AcceptThreadDto) {
    return this.threadsService.acceptThread(threadId, acceptDto);
  }

  @Post(':ticketId/threads/:threadId/decline')
  @CheckPolicies((ability) => ability.can(Action.Update, ThreadParticipant))
  @ApiOperation({ summary: 'Decline a thread invitation' })
  @ApiResponse({ status: 200, description: 'Thread declined successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async declineThread(@Param('threadId') threadId: string, @Body() declineDto: DeclineThreadDto) {
    return this.threadsService.declineThread(threadId, declineDto);
  }

  @Post(':ticketId/threads/:threadId/messages')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @CheckPolicies((ability) => ability.can(Action.Create, ThreadMessage))
  @ApiOperation({ summary: 'Add a message to a thread (with optional media)' })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async addThreadMessage(
    @Param('threadId') threadId: string,
    @Body() createMessageDto: CreateThreadMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.threadsService.addMessage(threadId, createMessageDto, user);
  }

  @Get(':ticketId/threads/:threadId/messages')
  @CheckPolicies((ability) => ability.can(Action.Read, ThreadMessage))
  @ApiOperation({ summary: 'Get all messages for a thread' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getThreadMessages(@Param('threadId') threadId: string) {
    return this.threadsService.getMessages(threadId);
  }
}
