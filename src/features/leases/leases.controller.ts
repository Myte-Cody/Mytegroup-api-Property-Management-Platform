import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateLeasePolicyHandler,
  DeleteLeasePolicyHandler,
  ReadLeasePolicyHandler,
  UpdateLeasePolicyHandler,
} from '../../common/casl/policies/lease.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { User } from '../users/schemas/user.schema';
import {
  CreateLeaseDto,
  LeaseQueryDto,
  LeaseResponseDto,
  MarkPaymentPaidDto,
  PaginatedLeasesResponseDto,
  TransactionResponseDto,
  RefundSecurityDepositDto,
  RenewLeaseDto,
  TerminateLeaseDto,
  UpdateLeaseDto,
  UploadPaymentProofDto,
} from './dto';
import { LeasesService } from './services/leases.service';
import { TransactionsService } from './services/transactions.service';

@ApiTags('Leases')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('leases')
export class LeasesController {
  constructor(
    private readonly leasesService: LeasesService,
    private readonly transactionsService: TransactionsService,
    private readonly mediaService: MediaService,
  ) {}

  @Get()
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get all leases with pagination, filtering, and sorting' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of leases',
    type: PaginatedLeasesResponseDto,
  })
  findAll(@Query() queryDto: LeaseQueryDto, @CurrentUser() user: User) {
    return this.leasesService.findAllPaginated(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get lease by ID' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lease details',
    type: LeaseResponseDto,
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.leasesService.findOne(id, user);
  }

  @Post()
  @CheckPolicies(new CreateLeasePolicyHandler())
  @ApiOperation({ summary: 'Create a new lease' })
  @ApiBody({ type: CreateLeaseDto })
  @ApiResponse({
    status: 201,
    description: 'Lease created successfully',
    type: LeaseResponseDto,
  })
  create(@Body() createLeaseDto: CreateLeaseDto, @CurrentUser() user: User) {
    return this.leasesService.create(createLeaseDto, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateLeasePolicyHandler())
  @ApiOperation({ summary: 'Update lease details' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: UpdateLeaseDto })
  @ApiResponse({
    status: 200,
    description: 'Lease updated successfully',
    type: LeaseResponseDto,
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateLeaseDto: UpdateLeaseDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.update(id, updateLeaseDto, user);
  }

  @Post(':id/terminate')
  @CheckPolicies(new UpdateLeasePolicyHandler())
  @ApiOperation({ summary: 'Terminate a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: TerminateLeaseDto })
  @ApiResponse({
    status: 200,
    description: 'Lease terminated successfully',
    type: LeaseResponseDto,
  })
  terminate(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() terminateLeaseDto: TerminateLeaseDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.terminate(id, terminateLeaseDto, user);
  }

  @Post(':id/renew')
  @CheckPolicies(new UpdateLeasePolicyHandler())
  @ApiOperation({ summary: 'Renew a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: RenewLeaseDto })
  @ApiResponse({
    status: 200,
    description: 'Lease renewed successfully',
  })
  renew(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() renewLeaseDto: RenewLeaseDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.renewLease(id, renewLeaseDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteLeasePolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lease (only draft leases)' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 204,
    description: 'Lease deleted successfully',
  })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.leasesService.remove(id, user);
  }

  @Get(':id/media')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get all media for a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lease media files',
  })
  async getLeaseMedia(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    await this.leasesService.findOne(leaseId, user);

    const media = await this.mediaService.getMediaForEntity(
      'Lease',
      leaseId,
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

  @Get(':id/documents')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get lease documents' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lease documents',
  })
  async getLeaseDocuments(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    await this.leasesService.findOne(leaseId, user);

    const documents = await this.mediaService.getMediaForEntity(
      'Lease',
      leaseId,
      user,
      'documents',
    );

    return {
      success: true,
      data: documents,
    };
  }

  @Get(':id/contracts')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get lease contracts' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lease contracts',
  })
  async getLeaseContracts(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    await this.leasesService.findOne(leaseId, user);

    const contracts = await this.mediaService.getMediaForEntity(
      'Lease',
      leaseId,
      user,
      'contracts',
    );

    return {
      success: true,
      data: contracts,
    };
  }

  @Patch(':id/refund-security-deposit')
  @CheckPolicies(new UpdateLeasePolicyHandler())
  @ApiOperation({ summary: 'Refund security deposit for a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: RefundSecurityDepositDto })
  @ApiResponse({
    status: 200,
    description: 'Security deposit refunded successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - lease has no security deposit or already refunded',
  })
  @ApiResponse({
    status: 404,
    description: 'Lease not found',
  })
  async refundSecurityDeposit(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Body() refundSecurityDepositDto: RefundSecurityDepositDto,
    @CurrentUser() user: User,
  ) {
    const updatedLease = await this.leasesService.refundSecurityDeposit(
      leaseId,
      refundSecurityDepositDto.refundReason,
      user,
    );

    return {
      success: true,
      data: updatedLease,
      message: 'Security deposit refunded successfully',
    };
  }

  @Get(':id/rental-periods/:rentalPeriodId/payment')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get payment details for a rental period' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiParam({ name: 'rentalPeriodId', description: 'Rental Period ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async getPaymentForRentalPeriod(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Param('rentalPeriodId', MongoIdValidationPipe) rentalPeriodId: string,
    @CurrentUser() user: User,
  ) {
    const payment = await this.leasesService.getPaymentForRentalPeriod(
      leaseId,
      rentalPeriodId,
      user,
    );

    return {
      success: true,
      data: payment,
    };
  }

  @Patch(':id/rental-periods/:rentalPeriodId/pay/submit')
  @CheckPolicies(new UpdateLeasePolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit payment proof (tenant action)' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiParam({ name: 'rentalPeriodId', description: 'Rental Period ID', type: String })
  @ApiBody({ type: UploadPaymentProofDto })
  @ApiResponse({
    status: 200,
    description: 'Payment proof submitted successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment not in correct status',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async submitPaymentProof(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Param('rentalPeriodId', MongoIdValidationPipe) rentalPeriodId: string,
    @Body() uploadPaymentProofDto: UploadPaymentProofDto,
    @CurrentUser() user: User,
  ) {
    const payment = await this.leasesService.submitPaymentProof(
      leaseId,
      rentalPeriodId,
      uploadPaymentProofDto,
      user,
    );

    return {
      success: true,
      data: payment,
      message: 'Payment proof submitted successfully',
    };
  }

}
