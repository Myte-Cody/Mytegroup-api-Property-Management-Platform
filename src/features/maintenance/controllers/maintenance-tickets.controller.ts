import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { MediaType } from '../../media/schemas/media.schema';
import { MediaService } from '../../media/services/media.service';
import { UserDocument } from '../../users/schemas/user.schema';
import {
  AssignTicketDto,
  CreateTicketDto,
  TicketQueryDto,
  UpdateTicketDto,
} from '../dto';
import { MaintenanceTicketsService } from '../services/maintenance-tickets.service';

@ApiTags('Maintenance Tickets')
@Controller('maintenance/tickets')
export class MaintenanceTicketsController {
  constructor(
    private readonly ticketsService: MaintenanceTicketsService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new maintenance ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req: { user: UserDocument },
  ) {
    return this.ticketsService.create(createTicketDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all maintenance tickets with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async findAll(
    @Query() query: TicketQueryDto,
    @Req() req: { user: UserDocument },
  ) {
    return this.ticketsService.findAllPaginated(query, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific maintenance ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket found' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: UserDocument },
  ) {
    return this.ticketsService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async update(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Req() req: { user: UserDocument },
  ) {
    return this.ticketsService.update(id, updateTicketDto, req.user);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign a contractor to a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Only landlords can assign tickets' })
  @ApiResponse({ status: 404, description: 'Ticket or contractor not found' })
  async assign(
    @Param('id') id: string,
    @Body() assignDto: AssignTicketDto,
    @Req() req: { user: UserDocument },
  ) {
    return this.ticketsService.assignTicket(id, assignDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Ticket deleted successfully' })
  @ApiResponse({ status: 400, description: 'Only open tickets can be deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async remove(
    @Param('id') id: string,
    @Req() req: { user: UserDocument },
  ) {
    return this.ticketsService.remove(id, req.user);
  }

  @Get(':id/media')
  @ApiOperation({ summary: 'Get all media for a maintenance ticket' })
  @ApiParam({ name: 'id', description: 'Ticket ID', type: String })
  async getTicketMedia(
    @Param('id') ticketId: string,
    @Req() req: { user: UserDocument },
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    await this.ticketsService.findOne(ticketId, req.user);

    const media = await this.mediaService.getMediaForEntity('MaintenanceTicket', ticketId, req.user, collectionName, {
      media_type: mediaType,
    });

    return {
      success: true,
      data: media,
    };
  }
}