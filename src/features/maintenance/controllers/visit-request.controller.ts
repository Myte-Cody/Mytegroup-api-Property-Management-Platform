import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateVisitRequestPolicyHandler,
  ReadVisitRequestPolicyHandler,
  UpdateVisitRequestPolicyHandler,
} from '../../../common/casl/policies/visit-request.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { User } from '../../users/schemas/user.schema';
import { CreateVisitRequestDto, RespondVisitRequestDto, VisitRequestQueryDto } from '../dto';
import { VisitRequestService } from '../services/visit-request.service';

@ApiTags('Visit Requests')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('visit-requests')
export class VisitRequestController {
  constructor(private readonly visitRequestService: VisitRequestService) {}

  @Post()
  @CheckPolicies(new CreateVisitRequestPolicyHandler())
  @ApiOperation({ summary: 'Create a new visit request (contractors only)' })
  create(@CurrentUser() user: User, @Body() createDto: CreateVisitRequestDto) {
    return this.visitRequestService.create(createDto, user);
  }

  @Post('marketplace')
  @Public()
  @ApiOperation({ summary: 'Create a marketplace visit request (no authentication required)' })
  createMarketplace(@Body() createDto: CreateVisitRequestDto) {
    return this.visitRequestService.create(createDto);
  }

  @Get()
  @CheckPolicies(new ReadVisitRequestPolicyHandler())
  @ApiOperation({ summary: 'Get all visit requests for the current user' })
  findAll(@Query() queryDto: VisitRequestQueryDto, @CurrentUser() user: User) {
    return this.visitRequestService.findAll(queryDto, user);
  }

  @Get('ticket/:ticketId')
  @CheckPolicies(new ReadVisitRequestPolicyHandler())
  @ApiOperation({ summary: 'Get visit requests by ticket ID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  getByTicket(
    @Param('ticketId', MongoIdValidationPipe) ticketId: string,
    @CurrentUser() user: User,
  ) {
    return this.visitRequestService.getByTicket(ticketId, user);
  }

  @Get('scope-of-work/:sowId')
  @CheckPolicies(new ReadVisitRequestPolicyHandler())
  @ApiOperation({ summary: 'Get visit requests by scope of work ID' })
  @ApiParam({ name: 'sowId', description: 'Scope of Work ID' })
  getByScopeOfWork(
    @Param('sowId', MongoIdValidationPipe) sowId: string,
    @CurrentUser() user: User,
  ) {
    return this.visitRequestService.getByScopeOfWork(sowId, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadVisitRequestPolicyHandler())
  @ApiOperation({ summary: 'Get a visit request by ID' })
  @ApiParam({ name: 'id', description: 'Visit Request ID' })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.visitRequestService.findOne(id, user);
  }

  @Patch(':id/respond')
  @CheckPolicies(new UpdateVisitRequestPolicyHandler())
  @ApiOperation({ summary: 'Respond to a visit request (accept/refuse) - tenants and landlords only' })
  @ApiParam({ name: 'id', description: 'Visit Request ID' })
  respond(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
    @Body() respondDto: RespondVisitRequestDto,
  ) {
    return this.visitRequestService.respond(id, respondDto, user);
  }

  @Patch(':id/cancel')
  @CheckPolicies(new UpdateVisitRequestPolicyHandler())
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a visit request (contractors only)' })
  @ApiParam({ name: 'id', description: 'Visit Request ID' })
  cancel(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.visitRequestService.cancel(id, user);
  }
}
