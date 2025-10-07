import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';
import { Action } from '../../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../../common/casl/services/casl-authorization.service';
import {
  LeaseStatus,
  PaymentCycle,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  RentalPeriodStatus,
} from '../../../common/enums/lease.enum';
import { UnitAvailabilityStatus } from '../../../common/enums/unit.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { SessionService } from '../../../common/services/session.service';
import { addDaysToDate, getToday } from '../../../common/utils/date.utils';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { LeaseEmailService } from '../../email/services/lease-email.service';
import { MediaService } from '../../media/services/media.service';
import { Unit } from '../../properties/schemas/unit.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  CreateLeaseDto,
  ManualRenewLeaseDto,
  RenewLeaseDto,
  TerminateLeaseDto,
  UpdateLeaseDto,
} from '../dto';
import { LeaseQueryDto } from '../dto/lease-query.dto';
import { RentRollQueryDto, RentRollSortBy } from '../dto/rent-roll-query.dto';
import { RentRollResponseDto } from '../dto/rent-roll-response.dto';
import { Lease } from '../schemas/lease.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { Transaction } from '../schemas/transaction.schema';
import {
  calculateRentIncrease,
  normalizeToUTCStartOfDay,
  validateRenewalStartDate,
} from '../utils/renewal.utils';
import {
  completeFullCycle,
  generateTransactionSchedule,
} from '../utils/transaction-schedule.utils';
import { TransactionsService } from './transactions.service';

@Injectable()
export class LeasesService {
  constructor(
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: AppModel<Transaction>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly transactionsService: TransactionsService,
    private readonly caslAuthorizationService: CaslAuthorizationService,
    private readonly leaseEmailService: LeaseEmailService,
    private readonly mediaService: MediaService,
    private readonly sessionService: SessionService,
  ) {}

  async findAllPaginated(leaseQueryDto: LeaseQueryDto, currentUser: UserDocument) {
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

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    let baseQuery = (this.leaseModel.find() as any).accessibleBy(ability, Action.Read);

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
      const unitsInProperty = await this.unitModel
        .find({ property: propertyId })
        .select('_id')
        .exec();
      const unitIds = unitsInProperty.map((unit) => unit._id);
      baseQuery = baseQuery.where({ unit: { $in: unitIds } });
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
        .populate({
          path: 'unit',
          select: 'unitNumber type availabilityStatus',
          populate: { path: 'property', select: 'name address' },
        })
        .populate('tenant', 'name')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    // Transform leases to include property at the top level
    const transformedLeases = leases.map((lease: any) => {
      const leaseObj = lease.toObject ? lease.toObject() : lease;
      return {
        ...leaseObj,
        property: leaseObj.unit?.property || null,
      };
    });

    return createPaginatedResponse(transformedLeases, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    const lease = await this.leaseModel
      .findById(id)
      .populate({
        path: 'unit',
        select: 'unitNumber type availabilityStatus size',
        populate: { path: 'property', select: 'name address' },
      })
      .populate('tenant', 'name')
      .exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    return lease;
  }

  async create(createLeaseDto: CreateLeaseDto, currentUser: UserDocument): Promise<Lease> {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      await this.validateLeaseCreation(createLeaseDto);

      // Apply full cycle completion to ensure duration is a multiple of payment cycles
      const completedEndDate = completeFullCycle(
        createLeaseDto.startDate,
        createLeaseDto.endDate,
        createLeaseDto.paymentCycle,
      );

      const newLease = new this.leaseModel({
        ...createLeaseDto,
        rentIncrease:
          typeof createLeaseDto.rentIncrease == 'string'
            ? JSON.parse(createLeaseDto.rentIncrease)
            : createLeaseDto.rentIncrease,
        endDate: completedEndDate,
      });

      const savedLease = await newLease.save({ session });

      if (createLeaseDto.status === LeaseStatus.ACTIVE) {
        await this.activateLease(savedLease, session);
      }

      // If document files are provided, upload them
      if (createLeaseDto.documents && createLeaseDto.documents.length > 0) {
        const uploadPromises = createLeaseDto.documents.map(async (file) => {
          return this.mediaService.upload(
            file,
            savedLease,
            currentUser,
            'lease_documents',
            undefined,
            'Lease',
            session,
          );
        });

        const uploadedMedia = await Promise.all(uploadPromises);

        return savedLease;
      }

      return savedLease;
    });
  }

  async update(
    id: string,
    updateLeaseDto: UpdateLeaseDto,
    currentUser: UserDocument,
  ): Promise<Lease> {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      if (!updateLeaseDto || Object.keys(updateLeaseDto).length === 0) {
        throw new UnprocessableEntityException('Update data cannot be empty');
      }

      const existingLease = await this.leaseModel.findById(id, null, { session }).exec();

      if (!existingLease) {
        throw new NotFoundException(`Lease with ID ${id} not found`);
      }

      await this.validateLeaseUpdate(existingLease, updateLeaseDto);

      if (
        updateLeaseDto.paymentCycle &&
        updateLeaseDto.paymentCycle !== existingLease.paymentCycle
      ) {
        await this.handlePaymentCycleChange(existingLease, updateLeaseDto.paymentCycle, session);
      }

      if (updateLeaseDto.status && updateLeaseDto.status !== existingLease.status) {
        await this.handleStatusChange(existingLease, updateLeaseDto.status, session);
      }

      Object.assign(existingLease, updateLeaseDto);
      return await existingLease.save({ session });
    });
  }

  async terminate(
    id: string,
    terminationData: TerminateLeaseDto,
    currentUser: UserDocument,
  ): Promise<Lease> {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const lease = await this.leaseModel.findById(id, null, { session }).exec();

      if (!lease) {
        throw new NotFoundException(`Lease with ID ${id} not found`);
      }

      // Validate that lease is active
      if (lease.status !== LeaseStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot terminate lease with status '${lease.status}'. Only active leases can be terminated.`,
        );
      }

      const terminationDate = normalizeToUTCStartOfDay(terminationData.terminationDate);
      const leaseEndDate = normalizeToUTCStartOfDay(new Date(lease.endDate));

      // Validate that termination date is not after lease end date
      if (terminationDate > leaseEndDate) {
        throw new BadRequestException(
          `Termination date cannot be after lease end date (${leaseEndDate.toISOString().split('T')[0]})`,
        );
      }

      // Get current rental period first to use its start date for calculation
      const currentRentalPeriod = await this.rentalPeriodModel
        .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE }, null, { session })
        .exec();

      if (!currentRentalPeriod) {
        throw new BadRequestException('No active rental period found for termination');
      }

      const calculatedEndDate = completeFullCycle(
        currentRentalPeriod.startDate,
        terminationDate,
        lease.paymentCycle,
      );

      lease.status = LeaseStatus.TERMINATED;
      lease.terminationDate = terminationDate;

      if (terminationData.terminationReason) {
        lease.terminationReason = terminationData.terminationReason;
      }

      currentRentalPeriod.endDate = calculatedEndDate;
      currentRentalPeriod.status = RentalPeriodStatus.EXPIRED;
      await currentRentalPeriod.save({ session });

      await this.transactionModel.deleteMany(
        {
          lease: id,
          status: PaymentStatus.PENDING,
          dueDate: { $gt: terminationDate },
        },
        { session },
      );

      // Delete rental periods that start after the termination date
      await this.rentalPeriodModel.deleteMany(
        {
          lease: id,
          startDate: { $gt: terminationDate },
        },
        { session },
      );

      await this.unitModel.findByIdAndUpdate(
        lease.unit,
        {
          availabilityStatus: UnitAvailabilityStatus.VACANT,
        },
        { session },
      );

      const savedLease = await lease.save({ session });

      // Send lease termination email notifications
      await this.sendLeaseTerminationEmails(savedLease, terminationData);

      return savedLease;
    });
  }

  async renewLease(
    id: string,
    renewalData: RenewLeaseDto,
    currentUser: UserDocument,
  ): Promise<{ lease: Lease; newRentalPeriod: RentalPeriod }> {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const lease = await this.leaseModel.findById(id, null, { session }).exec();

      if (!lease) {
        throw new NotFoundException(`Lease with ID ${id} not found`);
      }

      // Get current active rental period
      const currentRentalPeriod = await this.rentalPeriodModel
        .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE }, null, { session })
        .exec();

      if (!currentRentalPeriod) {
        throw new UnprocessableEntityException('No active rental period found for renewal');
      }

      // Check if there are any future/pending rental periods (indicating lease already renewed)
      const futureRentalPeriod = await this.rentalPeriodModel
        .findOne(
          {
            lease: id,
            status: RentalPeriodStatus.PENDING,
            startDate: { $gt: currentRentalPeriod.endDate },
          },
          null,
          { session },
        )
        .exec();

      if (futureRentalPeriod) {
        throw new BadRequestException(
          'Cannot renew lease: A future rental period already exists. The lease has already been renewed.',
        );
      }

      try {
        validateRenewalStartDate(
          new Date(renewalData.startDate),
          new Date(currentRentalPeriod.endDate),
        );
      } catch (error) {
        throw new UnprocessableEntityException(error.message);
      }

      const rentCalculation = calculateRentIncrease(lease);
      const newRentAmount = rentCalculation.newRentAmount;
      let appliedRentIncrease = null;

      if (rentCalculation.rentIncrease) {
        appliedRentIncrease = {
          type: rentCalculation.rentIncrease.type,
          amount: rentCalculation.rentIncrease.amount,
          previousRent: currentRentalPeriod.rentAmount,
        };
      }

      try {
        const newRentalPeriod = new this.rentalPeriodModel({
          lease: id,
          startDate: normalizeToUTCStartOfDay(renewalData.startDate),
          endDate: normalizeToUTCStartOfDay(renewalData.endDate),
          rentAmount: newRentAmount,
          status: RentalPeriodStatus.PENDING,
          appliedRentIncrease,
          renewedFrom: currentRentalPeriod._id,
        });

        const savedNewRentalPeriod = await newRentalPeriod.save({ session });

        currentRentalPeriod.renewedTo = new Types.ObjectId(savedNewRentalPeriod._id.toString());

        lease.endDate = renewalData.endDate;
        lease.rentAmount = newRentAmount;

        const transactionSchedule = generateTransactionSchedule(
          renewalData.startDate,
          renewalData.endDate,
          lease.paymentCycle,
        );

        await this.createTransactionsForSchedule(
          id,
          savedNewRentalPeriod._id.toString(),
          newRentAmount,
          transactionSchedule,
          session,
        );

        await currentRentalPeriod.save({ session });
        const savedLease = await lease.save({ session });

        // Send lease renewal email notifications
        await this.sendLeaseRenewalEmails(savedLease, savedNewRentalPeriod, currentRentalPeriod);

        return { lease: savedLease, newRentalPeriod: savedNewRentalPeriod };
      } catch (error) {
        throw error;
      }
    });
  }

  async manualRenewLease(
    id: string,
    manualRenewalData: ManualRenewLeaseDto,
    currentUser: UserDocument,
  ): Promise<{ lease: Lease; newRentalPeriod: RentalPeriod }> {
    // Fetch the lease to get current endDate and rent increase configuration
    const lease = await this.leaseModel.findById(id).populate('unit').populate('tenant').exec();

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot renew lease with status '${lease.status}'. Only active leases can be renewed.`,
      );
    }

    // Validate that the desired end date is after the current lease end date
    if (manualRenewalData.desiredEndDate <= lease.endDate) {
      throw new BadRequestException('Desired end date must be after current lease end date');
    }

    // Get current active rental period to determine correct start date
    const currentRentalPeriod = await this.rentalPeriodModel
      .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE })
      .exec();

    if (!currentRentalPeriod) {
      throw new UnprocessableEntityException('No active rental period found for renewal');
    }

    // Check if there are any future/pending rental periods (indicating lease already renewed)
    const futureRentalPeriod = await this.rentalPeriodModel
      .findOne({
        lease: id,
        status: RentalPeriodStatus.PENDING,
        startDate: { $gt: currentRentalPeriod.endDate },
      })
      .exec();

    if (futureRentalPeriod) {
      throw new BadRequestException(
        'Cannot renew lease: A future rental period already exists. The lease has already been renewed.',
      );
    }

    // Complete the desired end date to ensure duration is a multiple of payment cycles
    const startDate = addDaysToDate(currentRentalPeriod.endDate, 1);
    const completedEndDate = completeFullCycle(
      startDate,
      manualRenewalData.desiredEndDate,
      lease.paymentCycle,
    );

    const renewalData: RenewLeaseDto = {
      startDate: startDate,
      endDate: completedEndDate,
      notes: manualRenewalData.notes,
    };

    // Use the existing renewLease function as a helper
    return this.renewLease(id, renewalData, currentUser);
  }

  async remove(id: string, currentUser: UserDocument) {
    const lease = await this.leaseModel.findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    if (lease.status !== LeaseStatus.DRAFT) {
      throw new UnprocessableEntityException('Only draft leases can be deleted');
    }

    lease.deleted = true;
    await lease.save();
    return { message: 'Lease deleted successfully' };
  }

  async getRentRoll(
    queryDto: RentRollQueryDto,
    currentUser: UserDocument,
  ): Promise<RentRollResponseDto> {
    const propertyFilter = queryDto.propertyId
      ? { property: new Types.ObjectId(queryDto.propertyId) }
      : {};

    const leaseAggregation = await this.leaseModel
      .aggregate([
        {
          $match: {
            status: { $in: [LeaseStatus.ACTIVE] },
            deleted: { $ne: true },
          },
        },
        ...(queryDto.propertyId
          ? [
              {
                $lookup: {
                  from: 'units',
                  localField: 'unit',
                  foreignField: '_id',
                  as: 'unitData',
                },
              },
              { $unwind: '$unitData' },
              { $match: { 'unitData.property': new Types.ObjectId(queryDto.propertyId) } },
            ]
          : []),
        {
          $group: {
            _id: null,
            totalMonthlyRent: { $sum: '$rentAmount' },
            activeLeaseIds: { $push: '$_id' },
          },
        },
      ])
      .exec();

    const totalMonthlyRent = leaseAggregation[0]?.totalMonthlyRent || 0;
    const activeLeaseIds = leaseAggregation[0]?.activeLeaseIds || [];

    // Aggregation 2: Get collected and outstanding amounts in one pipeline
    const transactionAggregation = await this.transactionModel
      .aggregate([
        {
          $match: {
            lease: { $in: activeLeaseIds },
            type: PaymentType.RENT,
            dueDate: { $lt: new Date() },
            deleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            collectedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', PaymentStatus.PAID] }, '$amount', 0],
              },
            },
            outstandingAmount: {
              $sum: {
                $cond: [{ $ne: ['$status', PaymentStatus.PAID] }, '$amount', 0],
              },
            },
          },
        },
      ])
      .exec();

    const collectedAmount = transactionAggregation[0]?.collectedAmount || 0;
    const outstandingAmount = transactionAggregation[0]?.outstandingAmount || 0;

    // Aggregation 3: Get unit counts (total and vacant) in one pipeline
    const unitAggregation = await this.unitModel
      .aggregate([
        {
          $match: {
            ...propertyFilter,
            deleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalUnits: { $sum: 1 },
            vacantUnits: {
              $sum: {
                $cond: [{ $eq: ['$availabilityStatus', UnitAvailabilityStatus.VACANT] }, 1, 0],
              },
            },
          },
        },
      ])
      .exec();

    const totalUnits = unitAggregation[0]?.totalUnits || 0;
    const vacantUnits = unitAggregation[0]?.vacantUnits || 0;

    // Calculate outstanding from non-active leases (expired, terminated)
    const nonActiveOutstandingAggregation = await this.transactionModel
      .aggregate([
        {
          $lookup: {
            from: 'leases',
            localField: 'lease',
            foreignField: '_id',
            as: 'leaseData',
          },
        },
        { $unwind: '$leaseData' },
        {
          $match: {
            'leaseData.status': { $in: [LeaseStatus.EXPIRED, LeaseStatus.TERMINATED] },
            'leaseData.deleted': { $ne: true },
            status: { $ne: PaymentStatus.PAID },
          },
        },
        ...(queryDto.propertyId
          ? [
              {
                $lookup: {
                  from: 'units',
                  localField: 'leaseData.unit',
                  foreignField: '_id',
                  as: 'unitData',
                },
              },
              { $unwind: '$unitData' },
              { $match: { 'unitData.property': new Types.ObjectId(queryDto.propertyId) } },
            ]
          : []),
        {
          $group: {
            _id: null,
            outstandingAmountNonActive: {
              $sum: { $subtract: ['$amount', '$amountPaid'] },
            },
          },
        },
      ])
      .exec();

    const outstandingAmountNonActive =
      nonActiveOutstandingAggregation[0]?.outstandingAmountNonActive || 0;

    // Calculate collection rate based on total expected (collected + outstanding)
    const totalExpected = collectedAmount + outstandingAmount;
    const collectionRate = totalExpected > 0 ? (collectedAmount / totalExpected) * 100 : 0;

    const summary = {
      totalMonthlyRent,
      collectedAmount,
      outstandingAmount,
      outstandingAmountNonActive,
      collectionRate,
      vacantUnits,
      totalUnits,
    };

    // Build rent roll items aggregation
    const rentRollPipeline: any[] = [
      // Start with leases
      {
        $match: {
          deleted: { $ne: true },
        },
      },
      // Join with unit
      {
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      },
      { $unwind: '$unitData' },
      // Join with property
      {
        $lookup: {
          from: 'properties',
          localField: 'unitData.property',
          foreignField: '_id',
          as: 'propertyData',
        },
      },
      { $unwind: '$propertyData' },
      // Join with tenant
      {
        $lookup: {
          from: 'tenants',
          localField: 'tenant',
          foreignField: '_id',
          as: 'tenantData',
        },
      },
      { $unwind: '$tenantData' },
      // Join with users to get tenant email and phone
      {
        $lookup: {
          from: 'users',
          let: { tenantId: '$tenantData._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization_id', '$$tenantId'] },
                    { $eq: ['$isPrimary', true] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'tenantUser',
        },
      },
      // Join with transactions (type: RENT only)
      {
        $lookup: {
          from: 'transactions',
          let: { leaseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$lease', '$$leaseId'] },
                type: PaymentType.RENT,
                deleted: { $ne: true },
              },
            },
          ],
          as: 'transactions',
        },
      },
      // Calculate payment metrics
      {
        $addFields: {
          // Amount collected: sum of paid rent transactions
          amountCollected: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$transactions',
                    as: 'txn',
                    cond: { $eq: ['$$txn.status', PaymentStatus.PAID] },
                  },
                },
                as: 'paidTxn',
                in: '$$paidTxn.amount',
              },
            },
          },
          // Outstanding balance: sum of overdue rent transactions
          outstandingBalance: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$transactions',
                    as: 'txn',
                    cond: { $eq: ['$$txn.status', PaymentStatus.OVERDUE] },
                  },
                },
                as: 'overdueTxn',
                in: '$$overdueTxn.amount',
              },
            },
          },
          // Last payment date: most recent paid transaction date
          lastPaymentDate: {
            $max: {
              $map: {
                input: {
                  $filter: {
                    input: '$transactions',
                    as: 'txn',
                    cond: { $eq: ['$$txn.status', PaymentStatus.PAID] },
                  },
                },
                as: 'paidTxn',
                in: '$$paidTxn.paidAt',
              },
            },
          },
          // Due date: most recent due date from unpaid transactions
          dueDate: {
            $max: {
              $map: {
                input: {
                  $filter: {
                    input: '$transactions',
                    as: 'txn',
                    cond: { $ne: ['$$txn.status', PaymentStatus.PAID] },
                  },
                },
                as: 'unpaidTxn',
                in: '$$unpaidTxn.dueDate',
              },
            },
          },
        },
      },
    ];

    // Apply property filter if provided
    if (queryDto.propertyId) {
      rentRollPipeline.splice(1, 0, {
        $match: {
          'unitData.property': new Types.ObjectId(queryDto.propertyId),
        },
      });
    }

    // Apply search filter if provided
    if (queryDto.search) {
      const searchRegex = new RegExp(queryDto.search, 'i');
      rentRollPipeline.push({
        $match: {
          $or: [{ 'propertyData.name': searchRegex }, { 'tenantData.name': searchRegex }],
        },
      });
    }

    // Project to final shape
    rentRollPipeline.push({
      $project: {
        _id: { $toString: '$_id' },
        leaseId: { $toString: '$_id' },
        propertyId: { $toString: '$propertyData._id' },
        propertyName: '$propertyData.name',
        unitNumber: '$unitData.unitNumber',
        unitId: { $toString: '$unitData._id' },
        tenantName: '$tenantData.name',
        tenantId: { $toString: '$tenantData._id' },
        monthlyRent: '$rentAmount',
        dueDate: { $ifNull: ['$dueDate', null] },
        amountCollected: 1,
        outstandingBalance: 1,
        lastPaymentDate: { $ifNull: ['$lastPaymentDate', null] },
      },
    });

    // Count total before pagination
    // Make sure the first stage in rentRollPipeline includes deleted: false
    if (rentRollPipeline.length > 0 && rentRollPipeline[0].$match) {
      rentRollPipeline[0].$match.deleted = false;
    } else if (rentRollPipeline.length === 0) {
      rentRollPipeline.unshift({ $match: { deleted: false } });
    }

    const countPipeline = [...rentRollPipeline, { $count: 'total' }];
    const countResult = await this.leaseModel.aggregate(countPipeline).exec();
    const totalCount = countResult[0]?.total || 0;

    // Apply sorting
    if (queryDto.sortBy && queryDto.sortOrder) {
      const sortField = this.mapRentRollSortField(queryDto.sortBy);
      rentRollPipeline.push({
        $sort: { [sortField]: queryDto.sortOrder === 'asc' ? 1 : -1 },
      });
    } else {
      // Default sort by property name
      rentRollPipeline.push({
        $sort: { propertyName: 1 },
      });
    }

    // Apply pagination
    const skip = (queryDto.page - 1) * queryDto.limit;
    rentRollPipeline.push({ $skip: skip }, { $limit: queryDto.limit });

    // Execute aggregation
    const rentRollItems = await this.leaseModel.aggregate(rentRollPipeline).exec();

    // Update pagination meta with correct total
    const totalPages = Math.ceil(totalCount / queryDto.limit);
    const meta = {
      page: queryDto.page,
      limit: queryDto.limit,
      totalPages: totalPages || 1,
      hasNext: queryDto.page < totalPages,
      hasPrev: queryDto.page > 1,
    };

    return {
      summary,
      rentRoll: rentRollItems,
      total: totalCount,
      meta,
    };
  }

  // Helper Methods

  private mapRentRollSortField(sortBy: RentRollSortBy): string {
    const sortFieldMap = {
      [RentRollSortBy.RENT_AMOUNT]: 'monthlyRent',
      [RentRollSortBy.DUE_DATE]: 'dueDate',
      [RentRollSortBy.TENANT_NAME]: 'tenantName',
      [RentRollSortBy.PROPERTY_NAME]: 'propertyName',
      [RentRollSortBy.AMOUNT_COLLECTED]: 'amountCollected',
      [RentRollSortBy.OUTSTANDING_BALANCE]: 'outstandingBalance',
    };
    return sortFieldMap[sortBy] || 'propertyName';
  }

  private async validateLeaseCreation(createLeaseDto: CreateLeaseDto) {
    const unit = await this.unitModel.findById(createLeaseDto.unit).exec();
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const tenant = await this.tenantModel.findById(createLeaseDto.tenant).exec();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check for overlapping leases (dates and cross-field validations handled by DTO)
    await this.validateNoOverlappingLeases(
      createLeaseDto.unit,
      new Date(createLeaseDto.startDate),
      new Date(createLeaseDto.endDate),
    );
  }

  private async validateLeaseUpdate(existingLease: Lease, updateLeaseDto: UpdateLeaseDto) {
    // Validate status transition
    if (updateLeaseDto.status && updateLeaseDto.status !== existingLease.status) {
      this.validateStatusTransition(existingLease.status, updateLeaseDto.status);
    }

    if (updateLeaseDto.startDate || updateLeaseDto.endDate) {
      const startDate = new Date(updateLeaseDto.startDate || existingLease.startDate);
      const endDate = new Date(updateLeaseDto.endDate || existingLease.endDate);

      if (existingLease.status === LeaseStatus.ACTIVE) {
        const today = getToday();

        // Don't allow changing start date of active lease to past
        if (updateLeaseDto.startDate && startDate < today) {
          throw new UnprocessableEntityException(
            'Cannot change start date of active lease to a past date',
          );
        }

        // Don't allow end date changes that would terminate lease immediately
        if (updateLeaseDto.endDate && endDate <= today) {
          throw new UnprocessableEntityException(
            'Cannot set end date of active lease to today or past. Use terminate instead',
          );
        }
      }

      // Check for overlapping leases if dates are changing
      const unitIdToValidate = updateLeaseDto.unit || existingLease.unit.toString();
      await this.validateNoOverlappingLeases(
        unitIdToValidate,
        startDate,
        endDate,
        existingLease._id.toString(),
      );
    }

    // Validate unit if changing unit
    if (updateLeaseDto.unit) {
      const unit = await this.unitModel.findById(updateLeaseDto.unit).exec();
      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      // Check unit availability if changing unit
      if (updateLeaseDto.unit !== existingLease.unit.toString()) {
        if (unit.availabilityStatus === UnitAvailabilityStatus.OCCUPIED) {
          const existingActiveLease = await this.leaseModel
            .findOne({
              unit: updateLeaseDto.unit,
              status: { $in: [LeaseStatus.ACTIVE] },
              _id: { $ne: existingLease._id },
            })
            .exec();

          if (existingActiveLease) {
            throw new UnprocessableEntityException(
              'Unit is currently occupied by another active lease',
            );
          }
        }
      }
    }
  }

  private validateStatusTransition(currentStatus: LeaseStatus, newStatus: LeaseStatus) {
    const validTransitions: Record<LeaseStatus, LeaseStatus[]> = {
      [LeaseStatus.DRAFT]: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATED],
      [LeaseStatus.ACTIVE]: [LeaseStatus.EXPIRED, LeaseStatus.TERMINATED],
      [LeaseStatus.EXPIRED]: [],
      [LeaseStatus.TERMINATED]: [],
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw new UnprocessableEntityException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`,
      );
    }
  }

  private async validateNoOverlappingLeases(
    unitId: string,
    startDate: Date,
    endDate: Date,
    excludeLeaseId?: string,
  ) {
    const query: any = {
      unit: unitId,
      status: { $in: [LeaseStatus.DRAFT, LeaseStatus.ACTIVE] },
      $or: [
        // New lease starts during existing lease period
        {
          startDate: { $lte: startDate },
          endDate: { $gt: startDate },
        },
        // New lease ends during existing lease period
        {
          startDate: { $lt: endDate },
          endDate: { $gte: endDate },
        },
        // New lease completely contains existing lease period
        {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
        },
        // Existing lease completely contains new lease period
        {
          startDate: { $lte: startDate },
          endDate: { $gte: endDate },
        },
      ],
    };

    // Exclude current lease from overlap check if updating
    if (excludeLeaseId) {
      query._id = { $ne: excludeLeaseId };
    }

    const overlappingLeases = await this.leaseModel.find(query).exec();

    if (overlappingLeases.length > 0) {
      const overlappingLease = overlappingLeases[0];
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      throw new UnprocessableEntityException(
        `Unit already has a ${overlappingLease.status.toLowerCase()} lease for the period ${formatDate(overlappingLease.startDate)} to ${formatDate(overlappingLease.endDate)}. ` +
          `The requested period ${formatDate(startDate)} to ${formatDate(endDate)} overlaps with this existing lease.`,
      );
    }
  }

  private async activateLease(lease: Lease, session?: ClientSession) {
    try {
      if (!lease.activatedAt) {
        lease.activatedAt = new Date();
        await lease.save({ session: session ?? null });
      }
      const initialRentalPeriod = new this.rentalPeriodModel({
        lease: lease._id,
        startDate: normalizeToUTCStartOfDay(lease.startDate),
        endDate: normalizeToUTCStartOfDay(lease.endDate),
        rentAmount: lease.rentAmount,
        status: RentalPeriodStatus.ACTIVE,
      });

      await initialRentalPeriod.save({ session: session ?? null });

      // Create payment schedule for the initial rental period
      const transactionSchedule = generateTransactionSchedule(
        lease.startDate,
        lease.endDate,
        lease.paymentCycle,
      );

      await this.createTransactionsForSchedule(
        lease._id.toString(),
        initialRentalPeriod._id.toString(),
        lease.rentAmount,
        transactionSchedule,
        session,
      );

      if (lease.isSecurityDeposit && lease.securityDepositAmount) {
        await this.createSecurityDepositTransaction(
          lease._id.toString(),
          lease.securityDepositAmount,
          lease.startDate,
          session,
        );
      }

      await this.unitModel.findByIdAndUpdate(
        lease.unit,
        {
          availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
        },
        { session: session ?? null },
      );

      // Send lease activation email notifications
      await this.sendLeaseActivationEmails(lease);
    } catch (error) {
      if (
        error.code === 11000 &&
        error.keyPattern &&
        error.keyPattern.lease &&
        error.keyPattern.status
      ) {
        throw new UnprocessableEntityException(
          'Cannot activate lease: An active rental period already exists for this lease.',
        );
      }

      throw error;
    }
  }

  async processDepositAssessment(
    leaseId: string,
    assessmentDto: any,
    currentUser: UserDocument,
  ): Promise<any> {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const lease = await this.leaseModel.findById(leaseId, null, { session }).exec();

      if (!lease) {
        throw new NotFoundException('Lease not found');
      }

      if (!lease.isSecurityDeposit) {
        throw new UnprocessableEntityException('This lease does not have a security deposit');
      }

      if (lease.securityDepositRefundedAt) {
        throw new UnprocessableEntityException('Security deposit has already been refunded');
      }

      // Validate that final refund amount doesn't exceed security deposit amount
      if (assessmentDto.finalRefundAmount > lease.securityDepositAmount) {
        throw new UnprocessableEntityException(
          `Final refund amount (${assessmentDto.finalRefundAmount}) cannot exceed security deposit amount (${lease.securityDepositAmount})`,
        );
      }

      // Calculate total deductions from deduction items
      const totalDeductions =
        assessmentDto.deductionItems?.reduce((sum: number, item: any) => sum + item.cost, 0) || 0;

      // Validate that finalRefundAmount matches calculation
      const expectedRefundAmount = lease.securityDepositAmount - totalDeductions;
      if (Math.abs(assessmentDto.finalRefundAmount - expectedRefundAmount) > 0.01) {
        throw new UnprocessableEntityException(
          `Final refund amount (${assessmentDto.finalRefundAmount}) does not match calculated amount (${expectedRefundAmount})`,
        );
      }

      // Create deposit assessment
      const depositAssessment = {
        assessmentDate: new Date(),
        deductionItems: assessmentDto.deductionItems || [],
        totalDeductions,
        finalRefundAmount: assessmentDto.finalRefundAmount,
        assessmentNotes: assessmentDto.assessmentNotes,
        status: 'completed',
      };

      // Create both refund and deduction transactions
      await this.createDepositSettlementTransactions(
        leaseId,
        lease.securityDepositAmount,
        totalDeductions,
        assessmentDto,
        session,
      );

      // Update lease with assessment and refund information
      const updatedLease = await this.leaseModel
        .findByIdAndUpdate(
          leaseId,
          {
            depositAssessment,
            securityDepositRefundedAt: new Date(),
            securityDepositRefundReason: assessmentDto.refundReason,
          },
          { new: true, session },
        )
        .populate({
          path: 'unit',
          populate: { path: 'property' },
        })
        .populate('tenant')
        .exec();

      return updatedLease;
    });
  }

  async getDepositAssessment(leaseId: string, currentUser: UserDocument): Promise<any> {
    const lease = await this.leaseModel
      .findById(leaseId)
      .select('isSecurityDeposit securityDepositAmount depositAssessment securityDepositRefundedAt')
      .exec();

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (!lease.isSecurityDeposit) {
      throw new UnprocessableEntityException('This lease does not have a security deposit');
    }

    return {
      hasDeposit: lease.isSecurityDeposit,
      depositAmount: lease.securityDepositAmount,
      assessment: lease.depositAssessment,
      isRefunded: !!lease.securityDepositRefundedAt,
      refundedAt: lease.securityDepositRefundedAt,
    };
  }

  private async handleStatusChange(lease: Lease, newStatus: LeaseStatus, session?: ClientSession) {
    if (newStatus === LeaseStatus.ACTIVE && lease.status === LeaseStatus.DRAFT) {
      await this.activateLease(lease, session);
    }
  }

  private async handlePaymentCycleChange(
    lease: Lease,
    newPaymentCycle: PaymentCycle,
    session?: ClientSession,
  ) {
    // Only handle payment cycle changes for active leases
    if (lease.status !== LeaseStatus.ACTIVE) {
      return;
    }

    // Get the current active rental period
    const currentRentalPeriod = await this.rentalPeriodModel
      .findOne({ lease: lease._id, status: RentalPeriodStatus.ACTIVE }, null, {
        session: session ?? null,
      })
      .exec();

    if (!currentRentalPeriod) {
      return; // No active rental period, nothing to update
    }

    // Delete all pending transactions for the current rental period
    await this.transactionModel.deleteMany(
      {
        lease: lease._id,
        rentalPeriod: currentRentalPeriod._id,
        status: PaymentStatus.PENDING,
      },
      { session: session ?? null },
    );

    // Generate new transaction schedule based on the new payment cycle
    // Calculate remaining period: from today to end of current rental period
    const today = new Date();
    const remainingStartDate =
      today > currentRentalPeriod.startDate ? today : currentRentalPeriod.startDate;

    const transactionSchedule = generateTransactionSchedule(
      remainingStartDate,
      currentRentalPeriod.endDate,
      newPaymentCycle,
    );

    // Create new transactions for the remaining period
    await this.createTransactionsForSchedule(
      lease._id.toString(),
      currentRentalPeriod._id.toString(),
      currentRentalPeriod.rentAmount,
      transactionSchedule,
      session,
    );
  }

  async getPaymentForRentalPeriod(
    leaseId: string,
    rentalPeriodId: string,
    currentUser: UserDocument,
  ): Promise<Transaction> {
    return this.transactionsService.getTransactionForRentalPeriod(
      leaseId,
      rentalPeriodId,
      currentUser,
    );
  }

  private async createTransactionsForSchedule(
    leaseId: string,
    rentalPeriodId: string,
    amount: number,
    dueDates: Date[],
    session?: ClientSession,
  ): Promise<void> {
    const transactionPromises = dueDates.map((dueDate) => {
      const transaction = new this.transactionModel({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
        amount: amount,
        type: PaymentType.RENT,
        status: PaymentStatus.PENDING,
        dueDate: dueDate,
      });
      return transaction.save({ session: session ?? null });
    });

    await Promise.all(transactionPromises);
  }

  private async createSecurityDepositTransaction(
    leaseId: string,
    amount: number,
    dueDate: Date,
    session?: ClientSession,
  ): Promise<void> {
    const securityDepositTransaction = new this.transactionModel({
      lease: leaseId,
      amount: amount,
      type: PaymentType.DEPOSIT,
      status: PaymentStatus.PENDING,
      dueDate: dueDate,
      notes: 'Security deposit for lease activation',
    });

    await securityDepositTransaction.save({ session: session ?? null });
  }

  /**
   * Send lease activation email notifications to both landlord and tenant
   */
  private async sendLeaseActivationEmails(lease: Lease): Promise<void> {
    try {
      // Populate lease with unit and tenant information
      const populatedLease = await this.leaseModel
        .findById(lease._id)
        .populate({
          path: 'unit',
          select: 'unitNumber type',
          populate: { path: 'property', select: 'name address' },
        })
        .populate('tenant', 'name')
        .exec();

      if (!populatedLease || !populatedLease.unit || !populatedLease.tenant) {
        console.error('Failed to send lease activation email: Missing lease details');
        return;
      }

      const unit = populatedLease.unit as any;
      const tenant = populatedLease.tenant as any;
      const property = unit.property as any;
      const users = await this.findTenantUsers(tenant._id);
      // Send email to tenants
      const tenantEmailPromises = users.map((user) =>
        this.leaseEmailService.sendLeaseActivatedEmail(
          {
            recipientName: tenant.name,
            recipientEmail: user.email,
            isTenant: true,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            propertyAddress: property.address,
            leaseStartDate: populatedLease.startDate,
            leaseEndDate: populatedLease.endDate,
            monthlyRent: populatedLease.rentAmount,
          },
          { queue: true },
        ),
      );

      // Find landlord users to notify
      const landlordUsers = await this.findLandlordUsers();

      // Send email to each landlord user
      const landlordEmailPromises = landlordUsers.map((user) =>
        this.leaseEmailService.sendLeaseActivatedEmail(
          {
            recipientName: user.username,
            recipientEmail: user.email,
            isTenant: false,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            propertyAddress: property.address,
            leaseStartDate: populatedLease.startDate,
            leaseEndDate: populatedLease.endDate,
            monthlyRent: populatedLease.rentAmount,
          },
          { queue: true },
        ),
      );

      await Promise.all([...tenantEmailPromises, ...landlordEmailPromises]);
    } catch (error) {
      // Log error but don't fail the lease activation if email sending fails
      console.error('Failed to send lease activation emails:', error);
    }
  }

  /**
   * Send lease termination email notifications to both landlord and tenant
   */
  private async sendLeaseTerminationEmails(
    lease: Lease,
    terminationData: TerminateLeaseDto,
  ): Promise<void> {
    try {
      // Populate lease with unit and tenant information
      const populatedLease = await this.leaseModel
        .findById(lease._id)
        .populate({
          path: 'unit',
          select: 'unitNumber type',
          populate: { path: 'property', select: 'name address' },
        })
        .populate('tenant', 'name')
        .exec();

      if (!populatedLease || !populatedLease.unit || !populatedLease.tenant) {
        console.error('Failed to send lease termination email: Missing lease details');
        return;
      }

      const unit = populatedLease.unit as any;
      const tenant = populatedLease.tenant as any;
      const property = unit.property as any;

      const moveOutDate = new Date(lease.terminationDate);

      const users = await this.findTenantUsers(tenant._id);
      // Send email to tenants
      const tenantEmailPromises = users.map((user) =>
        this.leaseEmailService.sendLeaseTerminationEmail(
          {
            recipientName: tenant.name,
            recipientEmail: user.email,
            isTenant: true,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            propertyAddress: property.address,
            originalLeaseEndDate: populatedLease.endDate,
            terminationDate: lease.terminationDate,
            terminationReason: lease.terminationReason,
            moveOutDate: moveOutDate,
            additionalNotes: terminationData.terminationReason,
          },
          { queue: true },
        ),
      );

      // Find landlord users to notify
      const landlordUsers = await this.findLandlordUsers();

      // Send email to each landlord user
      const landlordEmailPromises = landlordUsers.map((user) =>
        this.leaseEmailService.sendLeaseTerminationEmail(
          {
            recipientName: user.username,
            recipientEmail: user.email,
            isTenant: false,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            propertyAddress: property.address,
            originalLeaseEndDate: populatedLease.endDate,
            terminationDate: lease.terminationDate,
            terminationReason: lease.terminationReason || 'Mutual agreement',
            moveOutDate: moveOutDate,
            additionalNotes: terminationData.terminationReason || lease.terminationReason,
          },
          { queue: true },
        ),
      );

      await Promise.all([...tenantEmailPromises, ...landlordEmailPromises]);
    } catch (error) {
      console.error('Failed to send lease termination emails:', error);
    }
  }

  /**
   * Send lease renewal email notifications to both landlord and tenant
   */
  private async sendLeaseRenewalEmails(
    lease: Lease,
    newRentalPeriod: RentalPeriod,
    currentRentalPeriod: RentalPeriod,
  ): Promise<void> {
    try {
      // Populate lease with unit and tenant information
      const populatedLease = await this.leaseModel
        .findById(lease._id)
        .populate({
          path: 'unit',
          select: 'unitNumber type',
          populate: { path: 'property', select: 'name address' },
        })
        .populate('tenant', 'name')
        .exec();

      if (!populatedLease || !populatedLease.unit || !populatedLease.tenant) {
        console.error('Failed to send lease renewal email: Missing lease details');
        return;
      }

      const unit = populatedLease.unit as any;
      const tenant = populatedLease.tenant as any;
      const property = unit.property as any;

      // Determine if this is an auto-renewal or manual renewal
      const isAutoRenewal = lease.autoRenewal || false;

      // Send email to tenants
      const users = await this.findTenantUsers(tenant._id);
      const tenantEmailPromises = users.map((user) =>
        this.leaseEmailService.sendLeaseRenewalEmail(
          {
            recipientName: tenant.name,
            recipientEmail: user.email,
            isAutoRenewal: isAutoRenewal,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            currentLeaseEndDate: currentRentalPeriod.endDate,
            newLeaseStartDate: newRentalPeriod.startDate,
            newLeaseEndDate: newRentalPeriod.endDate,
            currentMonthlyRent: currentRentalPeriod.rentAmount,
            newMonthlyRent: newRentalPeriod.rentAmount,
            renewalDate: newRentalPeriod.startDate,
          },
          { queue: true },
        ),
      );
      // Find landlord users to notify
      const landlordUsers = await this.findLandlordUsers();

      // Send email to each landlord user
      const landlordEmailPromises = landlordUsers.map((user) =>
        this.leaseEmailService.sendLeaseRenewalEmail(
          {
            recipientName: user.username,
            recipientEmail: user.email,
            isAutoRenewal: isAutoRenewal,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            currentLeaseEndDate: currentRentalPeriod.endDate,
            newLeaseStartDate: newRentalPeriod.startDate,
            newLeaseEndDate: newRentalPeriod.endDate,
            currentMonthlyRent: currentRentalPeriod.rentAmount,
            newMonthlyRent: newRentalPeriod.rentAmount,
            renewalDate: newRentalPeriod.startDate,
          },
          { queue: true },
        ),
      );

      await Promise.all([...tenantEmailPromises, ...landlordEmailPromises]);
    } catch (error) {
      // Log error but don't fail the lease renewal if email sending fails
      console.error('Failed to send lease renewal emails:', error);
    }
  }

  /**
   * Find all users associated with a landlord tenant ID
   */
  private async findLandlordUsers(): Promise<any> {
    try {
      // Use mongoose connection to get User model
      const userModel = this.leaseModel.db.model('User');
      const user = await userModel.find({ user_type: 'Landlord' }).exec();
      return user;
    } catch (error) {
      console.error('Failed to find landlord user:', error);
      return [];
    }
  }

  /**
   * Send lease expiration warning emails to both landlord and tenant
   * This method can be called by a scheduled job for different warning periods (30, 15, 7 days)
   * @param daysRemaining Number of days remaining before lease expiration
   * @param baseDate Optional date to use as the base for calculation (defaults to today)
   */
  async sendLeaseExpirationWarningEmails(daysRemaining: number, baseDate?: Date): Promise<void> {
    // Use provided baseDate or default to today
    const referenceDate = baseDate ? new Date(baseDate) : new Date();

    try {
      // Calculate the target expiration date (referenceDate + daysRemaining)
      const expirationDate = new Date(referenceDate);
      expirationDate.setDate(referenceDate.getDate() + daysRemaining);

      // Find all active leases that expire on the target date
      const expiringLeases = await this.leaseModel
        .find({
          status: LeaseStatus.ACTIVE,
          endDate: {
            $gte: new Date(expirationDate.setHours(0, 0, 0, 0)),
            $lte: new Date(expirationDate.setHours(23, 59, 59, 999)),
          },
        })
        .populate({
          path: 'unit',
          select: 'unitNumber type',
          populate: { path: 'property', select: 'name address' },
        })
        .populate('tenant', 'name')
        .exec();

      // Process each expiring lease
      for (const lease of expiringLeases) {
        const unit = lease.unit as any;
        const tenant = lease.tenant as any;
        const property = unit.property as any;

        // Send email to tenant
        const users = await this.findTenantUsers(tenant._id);
        const tenantEmailPromises = users.map((user) =>
          this.leaseEmailService.sendLeaseExpirationWarningEmail(
            {
              recipientName: tenant.name,
              recipientEmail: user.email,
              isTenant: true,
              propertyName: property.name,
              unitIdentifier: unit.unitNumber,
              propertyAddress: property.address,
              leaseStartDate: lease.startDate,
              leaseEndDate: lease.endDate,
              daysRemaining: daysRemaining,
            },
            { queue: true },
          ),
        );
        // Find landlord users to notify
        const landlordUsers = await this.findLandlordUsers();

        // Send email to each landlord user
        const landlordEmailPromises = landlordUsers.map((user) =>
          this.leaseEmailService.sendLeaseExpirationWarningEmail(
            {
              recipientName: user.username,
              recipientEmail: user.email,
              isTenant: false,
              propertyName: property.name,
              unitIdentifier: unit.unitNumber,
              propertyAddress: property.address,
              leaseStartDate: lease.startDate,
              leaseEndDate: lease.endDate,
              daysRemaining: daysRemaining,
            },
            { queue: true },
          ),
        );
        await Promise.all([...tenantEmailPromises, ...landlordEmailPromises]);
      }
      const referenceDateStr = referenceDate.toISOString().split('T')[0];
      console.log(
        `Sent ${expiringLeases.length} lease expiration warning emails for ${daysRemaining}-day notices (reference date: ${referenceDateStr})`,
      );
    } catch (error) {
      const referenceDateStr = referenceDate
        ? referenceDate.toISOString().split('T')[0]
        : 'unknown';
      console.error(
        `Failed to send lease expiration warning emails for ${daysRemaining}-day notices (reference date: ${referenceDateStr}):`,
        error,
      );
    }
  }

  private async createDepositSettlementTransactions(
    leaseId: string,
    fullDepositAmount: number,
    totalDeductions: number,
    assessmentDto: any,
    session: ClientSession | null,
  ): Promise<void> {
    // Always create refund transaction (negative amount - money going TO tenant)
    const refundTransaction = new this.transactionModel({
      lease: leaseId,
      amount: -fullDepositAmount, // Negative amount - money flowing to tenant
      type: PaymentType.DEPOSIT_REFUND,
      status: PaymentStatus.PAID,
      paidAt: new Date(),
      notes: `Security deposit refund: ${assessmentDto.refundReason}`,
      paymentMethod: PaymentMethod.OTHER, // Default method for refunds
    });

    await refundTransaction.save({ session });

    // Create deduction transaction only if there are deductions (positive amount)
    if (totalDeductions > 0) {
      const deductionTransaction = new this.transactionModel({
        lease: leaseId,
        amount: totalDeductions, // Positive amount - money kept by landlord
        type: PaymentType.DEPOSIT_DEDUCTION,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        notes: `Security deposit deductions`,
        paymentMethod: PaymentMethod.OTHER, // No actual payment method for deductions
      });

      await deductionTransaction.save({ session });
    }
  }

  private async findTenantUsers(tenantId: string): Promise<any[]> {
    try {
      return this.userModel
        .find({
          organization_id: tenantId,
          user_type: 'Tenant',
        })
        .exec();
    } catch (error) {
      console.error('Failed to find tenant users:', error);
      return [];
    }
  }
}
