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
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
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
  AcceptTicketDto,
  AssignTicketDto,
  CloseTicketDto,
  CreateTicketDto,
  RefuseTicketDto,
  TicketQueryDto,
  UpdateTicketDto,
} from '../dto';
import { MaintenanceTicketsService } from '../services/maintenance-tickets.service';

@ApiTags('Maintenance Tickets')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('maintenance/tickets')
export class MaintenanceTicketsController {
  constructor(
    private readonly ticketsService: MaintenanceTicketsService,
    private readonly mediaService: MediaService,
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
  @ApiOperation({ summary: 'Mark a maintenance ticket as done' })
  @ApiResponse({ status: 200, description: 'Ticket marked as done successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async markAsDone(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.markAsDone(id, user);
  }

  @Post(':id/close')
  @CheckPolicies(new UpdateMaintenanceTicketPolicyHandler())
  @ApiOperation({ summary: 'Close a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket closed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async close(
    @Param('id') id: string,
    @Body() closeDto: CloseTicketDto,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.closeTicket(id, closeDto, user);
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
}
