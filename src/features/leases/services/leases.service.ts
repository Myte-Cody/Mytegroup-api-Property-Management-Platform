import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  LeaseStatus,
  PaymentStatus,
  PaymentType,
  RentalPeriodStatus,
} from '../../../common/enums/lease.enum';
import { UnitAvailabilityStatus } from '../../../common/enums/unit.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { UserDocument } from '../../users/schemas/user.schema';
import {
  CreateLeaseDto,
  MarkPaymentPaidDto,
  RenewLeaseDto,
  TerminateLeaseDto,
  UpdateLeaseDto,
  UploadPaymentProofDto,
} from '../dto';
import { LeaseQueryDto } from '../dto/lease-query.dto';
import { LeaseResponseDto, PaginatedLeasesResponseDto } from '../dto/lease-response.dto';
import { Lease } from '../schemas/lease.schema';
import { Payment } from '../schemas/payment.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { PaymentReferenceUtils } from '../utils/payment-reference.utils';
import { PaymentsService } from './payments.service';

@Injectable()
export class LeasesService {
  constructor(
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    @InjectModel(Payment.name)
    private readonly paymentModel: AppModel<Payment>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAllPaginated(
    leaseQueryDto: LeaseQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedLeasesResponseDto> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      propertyId,
      unitId,
      tenantId,
    } = leaseQueryDto;

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        success: true,
      };
    }

    let baseQuery = this.leaseModel.byTenant(landlordId).find();

    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { terms: { $regex: search, $options: 'i' } },
          { terminationReason: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (propertyId) {
      baseQuery = baseQuery.where({ property: propertyId });
    }

    if (unitId) {
      baseQuery = baseQuery.where({ unit: unitId });
    }

    if (tenantId) {
      baseQuery = baseQuery.where({ tenant: tenantId });
    }

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [leases, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('unit', 'unitNumber type availabilityStatus')
        .populate('tenant', 'name')
        .populate('property', 'name address')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data: leases as any[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev,
      },
      success: true,
    };
  }

  async findOne(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel
      .byTenant(landlordId)
      .findById(id)
      .populate('unit', 'unitNumber type availabilityStatus')
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    return lease;
  }

  async create(createLeaseDto: CreateLeaseDto, currentUser: UserDocument): Promise<Lease> {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Cannot create lease: No tenant context');
    }

    // Validate the lease data
    await this.validateLeaseCreation(createLeaseDto, landlordId);

    // Create lease
    const LeaseWithTenant = this.leaseModel.byTenant(landlordId);
    const newLease = new LeaseWithTenant(createLeaseDto);
    const savedLease = await newLease.save();

    // If lease is created as ACTIVE, create initial RentalPeriod and update unit status
    if (createLeaseDto.status === LeaseStatus.ACTIVE) {
      await this.activateLease(savedLease, landlordId);
    }

    return savedLease;
  }

  async update(
    id: string,
    updateLeaseDto: UpdateLeaseDto,
    currentUser: UserDocument,
  ): Promise<Lease> {
    if (!updateLeaseDto || Object.keys(updateLeaseDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Find existing lease
    const existingLease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!existingLease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    // Handle status changes
    if (updateLeaseDto.status && updateLeaseDto.status !== existingLease.status) {
      await this.handleStatusChange(existingLease, updateLeaseDto.status, landlordId);
    }

    // Update the lease
    Object.assign(existingLease, updateLeaseDto);
    return await existingLease.save();
  }

  async terminate(
    id: string,
    terminationData: TerminateLeaseDto,
    currentUser: UserDocument,
  ): Promise<Lease> {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    // Update lease status
    lease.status = LeaseStatus.TERMINATED;
    lease.terminationDate = terminationData.terminationDate || new Date();
    lease.terminationReason = terminationData.terminationReason;

    // Update current active rental period
    const currentRentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE })
      .exec();

    if (currentRentalPeriod) {
      currentRentalPeriod.status = RentalPeriodStatus.EXPIRED;
      await currentRentalPeriod.save();
    }

    // Update unit availability
    await this.unitModel.byTenant(landlordId).findByIdAndUpdate(lease.unit, {
      availabilityStatus: UnitAvailabilityStatus.VACANT,
    });

    return await lease.save();
  }

  async renewLease(
    id: string,
    renewalData: RenewLeaseDto,
    currentUser: UserDocument,
  ): Promise<{ lease: Lease; newRentalPeriod: RentalPeriod }> {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    // Get current active rental period
    const currentRentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE })
      .exec();

    if (!currentRentalPeriod) {
      throw new BadRequestException('No active rental period found for renewal');
    }

    // Calculate new rent amount
    let newRentAmount = renewalData.rentAmount || currentRentalPeriod.rentAmount;
    let appliedRentIncrease = null;

    if (renewalData.rentIncrease) {
      appliedRentIncrease = {
        type: renewalData.rentIncrease.type,
        amount: renewalData.rentIncrease.amount,
        previousRent: currentRentalPeriod.rentAmount,
        reason: renewalData.rentIncrease.reason,
      };

      if (renewalData.rentIncrease.type === 'PERCENTAGE') {
        newRentAmount =
          currentRentalPeriod.rentAmount * (1 + renewalData.rentIncrease.amount / 100);
      } else {
        newRentAmount = currentRentalPeriod.rentAmount + renewalData.rentIncrease.amount;
      }
    }

    // Mark current rental period as renewed
    currentRentalPeriod.status = RentalPeriodStatus.RENEWED;

    try {
      // Create new rental period
      const RentalPeriodWithTenant = this.rentalPeriodModel.byTenant(landlordId);
      const newRentalPeriod = new RentalPeriodWithTenant({
        lease: id,
        startDate: renewalData.startDate,
        endDate: renewalData.endDate,
        rentAmount: newRentAmount,
        status: RentalPeriodStatus.ACTIVE,
        appliedRentIncrease,
        renewedFrom: currentRentalPeriod._id,
        renewalNotes: renewalData.notes,
      });

      const savedNewRentalPeriod = await newRentalPeriod.save();

      // Link rental periods
      currentRentalPeriod.renewedTo = new Types.ObjectId(savedNewRentalPeriod._id.toString());

      // Update lease end date
      lease.endDate = renewalData.endDate;
      lease.rentAmount = newRentAmount;

      // Save all changes
      await currentRentalPeriod.save();
      await lease.save();

      return { lease, newRentalPeriod: savedNewRentalPeriod };
    } catch (error) {
      // Handle MongoDB duplicate key error
      if (
        error.code === 11000 &&
        error.keyPattern &&
        error.keyPattern.lease &&
        error.keyPattern.status
      ) {
        throw new BadRequestException(
          'Cannot renew lease: An active rental period already exists for this lease. Please terminate the current rental period before creating a new one.',
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  async remove(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Find lease
    const lease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    // Only allow deletion of DRAFT leases
    if (lease.status !== LeaseStatus.DRAFT) {
      throw new BadRequestException('Only draft leases can be deleted');
    }

    await this.leaseModel.byTenant(landlordId).findByIdAndDelete(id);
    return { message: 'Lease deleted successfully' };
  }

  // Helper Methods

  private async validateLeaseCreation(createLeaseDto: CreateLeaseDto, landlordId: Types.ObjectId) {
    // Validate unit exists and is available
    const unit = await this.unitModel.byTenant(landlordId).findById(createLeaseDto.unit).exec();
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    // Check if unit already has an active lease
    const existingLease = await this.leaseModel
      .byTenant(landlordId)
      .findOne({ unit: createLeaseDto.unit, status: LeaseStatus.ACTIVE })
      .exec();

    if (existingLease) {
      throw new BadRequestException('Unit already has an active lease');
    }

    // Validate tenant exists
    const tenant = await this.tenantModel
      .byTenant(landlordId)
      .findById(createLeaseDto.tenant)
      .exec();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Validate property exists
    const property = await this.propertyModel
      .byTenant(landlordId)
      .findById(createLeaseDto.property)
      .exec();
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Validate dates
    if (new Date(createLeaseDto.startDate) >= new Date(createLeaseDto.endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }
  }

  private async activateLease(lease: Lease, landlordId: Types.ObjectId) {
    try {
      const RentalPeriodWithTenant = this.rentalPeriodModel.byTenant(landlordId);
      const initialRentalPeriod = new RentalPeriodWithTenant({
        lease: lease._id,
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: lease.rentAmount,
        status: RentalPeriodStatus.ACTIVE,
      });

      await initialRentalPeriod.save();

      const PaymentWithTenant = this.paymentModel.byTenant(landlordId);

      const rentPaymentReference = await PaymentReferenceUtils.generatePaymentReference(
        this.paymentModel,
        landlordId,
      );
      const firstPayment = new PaymentWithTenant({
        lease: lease._id,
        rentalPeriod: initialRentalPeriod._id,
        tenant: lease.tenant,
        amount: lease.rentAmount,
        type: PaymentType.RENT,
        status: PaymentStatus.PENDING,
        dueDate: lease.startDate,
        description: 'First rent payment',
        reference: rentPaymentReference,
      });

      await firstPayment.save();

      await this.unitModel.byTenant(landlordId).findByIdAndUpdate(lease.unit, {
        availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
      });
    } catch (error) {
      if (
        error.code === 11000 &&
        error.keyPattern &&
        error.keyPattern.lease &&
        error.keyPattern.status
      ) {
        throw new BadRequestException(
          'Cannot activate lease: An active rental period already exists for this lease.',
        );
      }

      throw error;
    }
  }

  async refundSecurityDeposit(
    leaseId: string,
    refundReason: string,
    currentUser: UserDocument,
  ): Promise<any> {
    const landlordId = this.getLandlordId(currentUser);

    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (!lease.isSecurityDeposit) {
      throw new BadRequestException('This lease does not have a security deposit');
    }

    if (lease.securityDepositRefunded) {
      throw new BadRequestException('Security deposit has already been refunded');
    }

    const updatedLease = await this.leaseModel
      .byTenant(landlordId)
      .findByIdAndUpdate(
        leaseId,
        {
          securityDepositRefunded: true,
          securityDepositRefundedDate: new Date(),
          securityDepositRefundReason: refundReason,
        },
        { new: true },
      )
      .populate('unit property tenant')
      .exec();

    return updatedLease;
  }

  private async handleStatusChange(
    lease: Lease,
    newStatus: LeaseStatus,
    landlordId: Types.ObjectId,
  ) {
    if (newStatus === LeaseStatus.ACTIVE && lease.status === LeaseStatus.DRAFT) {
      await this.activateLease(lease, landlordId);
    }
  }

  async getPaymentForRentalPeriod(
    leaseId: string,
    rentalPeriodId: string,
    currentUser: UserDocument,
  ): Promise<Payment> {
    return this.paymentsService.getPaymentForRentalPeriod(leaseId, rentalPeriodId, currentUser);
  }

  async submitPaymentProof(
    leaseId: string,
    rentalPeriodId: string,
    submitDto: UploadPaymentProofDto,
    currentUser: UserDocument,
  ): Promise<Payment> {
    return this.paymentsService.submitPaymentProof(leaseId, rentalPeriodId, submitDto, currentUser);
  }

  async validatePayment(
    leaseId: string,
    rentalPeriodId: string,
    validateDto: MarkPaymentPaidDto,
    currentUser: UserDocument,
  ): Promise<Payment> {
    return this.paymentsService.validatePayment(leaseId, rentalPeriodId, validateDto, currentUser);
  }

  private getLandlordId(currentUser: UserDocument): Types.ObjectId | null {
    if (!currentUser.tenantId) {
      return null;
    }

    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : new Types.ObjectId(currentUser.tenantId);
  }
}
