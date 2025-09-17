import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RentalPeriodStatus } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../../common/utils/pagination.utils';
import { UserDocument } from '../../users/schemas/user.schema';
import { Lease } from '../schemas/lease.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';

@Injectable()
export class RentalPeriodsService {
  constructor(
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
  ) {}

  async findAllPaginated(
    queryDto: any, // TODO: Create RentalPeriodQueryDto
    currentUser: UserDocument,
  ): Promise<any> { // TODO: Create PaginatedRentalPeriodResponse
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      leaseId,
    } = queryDto;

    // mongo-tenant: Apply tenant isolation (mandatory for all users)
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      // Users without tenantId cannot access any RentalPeriod
      return createEmptyPaginatedResponse(page, limit);
    }

    let baseQuery = this.rentalPeriodModel.byTenant(landlordId).find();

    // Add filters
    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (leaseId) {
      baseQuery = baseQuery.where({ lease: leaseId });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries with population
    const [rentalPeriods, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'lease',
          select: 'unit tenant property',
          populate: [
            { path: 'unit', select: 'unitNumber type' },
            { path: 'tenant', select: 'name' },
            { path: 'property', select: 'name address' },
          ],
        })
        .populate('renewedFrom', 'startDate endDate rentAmount')
        .populate('renewedTo', 'startDate endDate rentAmount')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse(rentalPeriods, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    // mongo-tenant: Apply tenant filtering (mandatory)
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const rentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findById(id)
      .populate({
        path: 'lease',
        select: 'unit tenant property terms',
        populate: [
          { path: 'unit', select: 'unitNumber type' },
          { path: 'tenant', select: 'name' },
          { path: 'property', select: 'name address' },
        ],
      })
      .populate('renewedFrom', 'startDate endDate rentAmount')
      .populate('renewedTo', 'startDate endDate rentAmount')
      .exec();

    if (!rentalPeriod) {
      throw new NotFoundException(`RentalPeriod with ID ${id} not found`);
    }

    return rentalPeriod;
  }

  async findByLease(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists and user has access
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const rentalPeriods = await this.rentalPeriodModel
      .byTenant(landlordId)
      .find({ lease: leaseId })
      .sort({ startDate: 1 })
      .populate('renewedFrom', 'startDate endDate rentAmount')
      .populate('renewedTo', 'startDate endDate rentAmount')
      .exec();

    return rentalPeriods;
  }

  async findRenewalChain(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const rentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!rentalPeriod) {
      throw new NotFoundException(`RentalPeriod with ID ${id} not found`);
    }

    // Find the root of the renewal chain
    let root = rentalPeriod;
    while (root.renewedFrom) {
      root = await this.rentalPeriodModel
        .byTenant(landlordId)
        .findById(root.renewedFrom)
        .exec();
      if (!root) break;
    }

    // Build the complete chain from root
    const chain = [];
    let current = root;
    
    while (current) {
      chain.push(current);
      if (current.renewedTo) {
        current = await this.rentalPeriodModel
          .byTenant(landlordId)
          .findById(current.renewedTo)
          .exec();
      } else {
        current = null;
      }
    }

    return chain;
  }

  async getCurrentRentalPeriod(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const currentRentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findOne({
        lease: leaseId,
        status: RentalPeriodStatus.ACTIVE,
      })
      .populate('renewedFrom', 'startDate endDate rentAmount')
      .exec();

    return currentRentalPeriod;
  }

  async getRentHistory(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const rentalPeriods = await this.rentalPeriodModel
      .byTenant(landlordId)
      .find({ lease: leaseId })
      .sort({ startDate: 1 })
      .select('startDate endDate rentAmount status appliedRentIncrease')
      .exec();

    // Calculate rent increase analytics
    const rentHistory = rentalPeriods.map((rentalPeriod, index) => {
      let increaseAmount = 0;
      let increasePercentage = 0;

      if (index > 0 && rentalPeriod.appliedRentIncrease) {
        const previousRent = rentalPeriod.appliedRentIncrease.previousRent;
        increaseAmount = rentalPeriod.rentAmount - previousRent;
        increasePercentage = (increaseAmount / previousRent) * 100;
      }

      return {
        period: `${rentalPeriod.startDate.toISOString().split('T')[0]} - ${rentalPeriod.endDate.toISOString().split('T')[0]}`,
        rentAmount: rentalPeriod.rentAmount,
        status: rentalPeriod.status,
        appliedRentIncrease: rentalPeriod.appliedRentIncrease,
        calculatedIncrease: {
          amount: increaseAmount,
          percentage: increasePercentage,
        },
      };
    });

    return {
      leaseId,
      totalPeriods: rentalPeriods.length,
      currentRent: rentalPeriods[rentalPeriods.length - 1]?.rentAmount || 0,
      originalRent: rentalPeriods[0]?.rentAmount || 0,
      totalIncrease: (rentalPeriods[rentalPeriods.length - 1]?.rentAmount || 0) - (rentalPeriods[0]?.rentAmount || 0),
      history: rentHistory,
    };
  }

  private getLandlordId(currentUser: UserDocument) {
    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : currentUser.tenantId;
  }
}