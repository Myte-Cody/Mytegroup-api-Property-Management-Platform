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
import {
  CreateMediaPolicyHandler,
  DeleteMediaPolicyHandler,
} from '../../common/casl/policies/media.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { UploadMediaDto } from '../properties/dto/upload-media.dto';
import { User } from '../users/schemas/user.schema';
import {
  CreateLeaseDto,
  LeaseQueryDto,
  LeaseResponseDto,
  ManualRenewLeaseDto,
  ProcessDepositAssessmentDto,
  RentalPeriodResponseDto,
  TerminateLeaseDto,
  TransactionResponseDto,
  UpdateLeaseDto,
} from './dto';
import { RentRollQueryDto } from './dto/rent-roll-query.dto';
import { RentRollResponseDto } from './dto/rent-roll-response.dto';
import { LeasesService } from './services/leases.service';
import { RentalPeriodsService } from './services/rental-periods.service';
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
    private readonly rentalPeriodsService: RentalPeriodsService,
  ) {}

  @Get()
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get all leases with pagination, filtering, and sorting' })
  findAll(@Query() queryDto: LeaseQueryDto, @CurrentUser() user: User) {
    return this.leasesService.findAllPaginated(queryDto, user);
  }

  @Get('rent-roll')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get rent roll data with payment status and financial summary' })
  @ApiResponse({
    status: 200,
    description: 'Rent roll data with summary statistics',
    type: RentRollResponseDto,
  })
  getRentRoll(@Query() queryDto: RentRollQueryDto, @CurrentUser() user: User) {
    return this.leasesService.getRentRoll(queryDto, user);
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
  @FormDataRequest()
  @ApiOperation({ summary: 'Create a new lease with optional document files' })
  @ApiConsumes('multipart/form-data')
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
  @FormDataRequest()
  @ApiOperation({ summary: 'Update lease details with optional document files' })
  @ApiConsumes('multipart/form-data')
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
  @ApiOperation({ summary: 'Manually renew a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: ManualRenewLeaseDto })
  @ApiResponse({
    status: 200,
    description: 'Lease renewed successfully',
  })
  renew(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() manualRenewLeaseDto: ManualRenewLeaseDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.manualRenewLease(id, manualRenewLeaseDto, user);
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

  @Get(':id/deposit-assessment')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get deposit assessment status and details for a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Deposit assessment details retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Lease has no security deposit',
  })
  @ApiResponse({
    status: 404,
    description: 'Lease not found',
  })
  async getDepositAssessment(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    const assessment = await this.leasesService.getDepositAssessment(leaseId, user);

    return {
      success: true,
      data: assessment,
    };
  }

  @Post(':id/deposit-assessment')
  @CheckPolicies(new UpdateLeasePolicyHandler())
  @ApiOperation({ summary: 'Process deposit assessment and refund security deposit' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: ProcessDepositAssessmentDto })
  async processDepositAssessment(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Body() processDepositAssessmentDto: ProcessDepositAssessmentDto,
    @CurrentUser() user: User,
  ) {
    const updatedLease = await this.leasesService.processDepositAssessment(
      leaseId,
      processDepositAssessmentDto,
      user,
    );

    return {
      success: true,
      data: updatedLease,
      message: 'Deposit assessment processed and security deposit refunded successfully',
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

  @Get(':id/transactions')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get all transactions for a specific lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of transactions for the lease',
    type: [TransactionResponseDto],
  })
  getTransactions(@Param('id', MongoIdValidationPipe) leaseId: string, @CurrentUser() user: User) {
    return this.transactionsService.getTransactionsByLease(leaseId, user);
  }

  @Get(':id/transactions/summary')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get transaction summary analytics for a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  getTransactionSummary(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    return this.transactionsService.getTransactionSummary(leaseId, user);
  }

  @Get(':id/rental-periods')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get all rental periods for a specific lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  getRentalPeriods(@Param('id', MongoIdValidationPipe) leaseId: string, @CurrentUser() user: User) {
    return this.rentalPeriodsService.findByLease(leaseId, user);
  }

  @Get(':id/rental-periods/current')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get current active rental period for a lease' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Current active rental period',
    type: RentalPeriodResponseDto,
  })
  getCurrentRentalPeriod(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    return this.rentalPeriodsService.getCurrentRentalPeriod(leaseId, user);
  }

  @Post(':id/media/upload')
  @CheckPolicies(new CreateMediaPolicyHandler())
  @FormDataRequest()
  @ApiOperation({ summary: 'Upload media to lease' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiBody({ type: UploadMediaDto })
  @ApiResponse({
    status: 201,
    description: 'Media uploaded successfully',
  })
  async uploadLeaseMedia(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Body() uploadMediaDto: UploadMediaDto,
    @CurrentUser() user: User,
  ) {
    const lease = await this.leasesService.findOne(leaseId, user);

    const media = await this.mediaService.upload(
      uploadMediaDto.file,
      lease,
      user,
      uploadMediaDto.collection_name || 'lease_documents',
      undefined,
      'Lease',
    );

    return {
      success: true,
      data: media,
      message: 'Media uploaded successfully',
    };
  }

  @Delete(':id/media/:mediaId')
  @CheckPolicies(new DeleteMediaPolicyHandler())
  @ApiOperation({ summary: 'Delete lease media' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Media deleted successfully',
  })
  async deleteLeaseMedia(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Param('mediaId', MongoIdValidationPipe) mediaId: string,
    @CurrentUser() user: User,
  ) {
    await this.leasesService.findOne(leaseId, user);
    await this.mediaService.deleteMedia(mediaId, user);

    return {
      success: true,
      message: 'Media deleted successfully',
    };
  }

  @Get(':id/media/:mediaId/url')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get lease media URL' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Media URL retrieved successfully',
  })
  async getLeaseMediaUrl(
    @Param('id', MongoIdValidationPipe) leaseId: string,
    @Param('mediaId', MongoIdValidationPipe) mediaId: string,
    @CurrentUser() user: User,
  ) {
    await this.leasesService.findOne(leaseId, user);
    const media = await this.mediaService.findOne(mediaId, user);
    const url = await this.mediaService.getMediaUrl(media);

    return {
      success: true,
      data: { url },
    };
  }
}
