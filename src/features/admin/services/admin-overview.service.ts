import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contractor } from '../../contractors/schema/contractor.schema';
import { Landlord } from '../../landlords/schema/landlord.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { Transaction } from '../../leases/schemas/transaction.schema';
import { MaintenanceTicket } from '../../maintenance/schemas/maintenance-ticket.schema';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { Task } from '../../tasks/schemas/task.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User } from '../../users/schemas/user.schema';

export interface AdminOverviewStats {
  totalLandlords: number;
  totalUsers: number;
  totalTenants: number;
  totalContractors: number;
  totalProperties: number;
  totalUnits: number;
  totalActiveLeases: number;
  totalOpenTickets: number;
  totalPendingTransactions: number;
  totalOpenTasks: number;
  recentActivity: {
    newUsersLast7Days: number;
    newPropertiesLast7Days: number;
    newTicketsLast7Days: number;
    transactionsLast7Days: number;
  };
}

@Injectable()
export class AdminOverviewService {
  constructor(
    @InjectModel(Landlord.name) private landlordModel: Model<Landlord>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(Contractor.name) private contractorModel: Model<Contractor>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Unit.name) private unitModel: Model<Unit>,
    @InjectModel(Lease.name) private leaseModel: Model<Lease>,
    @InjectModel(MaintenanceTicket.name) private ticketModel: Model<MaintenanceTicket>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Task.name) private taskModel: Model<Task>,
  ) {}

  async getOverviewStats(): Promise<AdminOverviewStats> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalLandlords,
      totalUsers,
      totalTenants,
      totalContractors,
      totalProperties,
      totalUnits,
      totalActiveLeases,
      totalOpenTickets,
      totalPendingTransactions,
      totalOpenTasks,
      newUsersLast7Days,
      newPropertiesLast7Days,
      newTicketsLast7Days,
      transactionsLast7Days,
    ] = await Promise.all([
      this.landlordModel.countDocuments({ deleted: { $ne: true } }),
      this.userModel.countDocuments({ deleted: { $ne: true } }),
      this.tenantModel.countDocuments({ deleted: { $ne: true } }),
      this.contractorModel.countDocuments({ deleted: { $ne: true } }),
      this.propertyModel.countDocuments({ deleted: { $ne: true } }),
      this.unitModel.countDocuments({ deleted: { $ne: true } }),
      this.leaseModel.countDocuments({ status: 'ACTIVE', deleted: { $ne: true } }),
      this.ticketModel.countDocuments({
        status: { $nin: ['CLOSED', 'DONE'] },
        deleted: { $ne: true },
      }),
      this.transactionModel.countDocuments({
        status: 'PENDING',
        deleted: { $ne: true },
      }),
      this.taskModel.countDocuments({
        status: { $in: ['OPEN', 'IN_PROGRESS'] },
        deleted: { $ne: true },
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
        deleted: { $ne: true },
      }),
      this.propertyModel.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
        deleted: { $ne: true },
      }),
      this.ticketModel.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
        deleted: { $ne: true },
      }),
      this.transactionModel.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
        deleted: { $ne: true },
      }),
    ]);

    return {
      totalLandlords,
      totalUsers,
      totalTenants,
      totalContractors,
      totalProperties,
      totalUnits,
      totalActiveLeases,
      totalOpenTickets,
      totalPendingTransactions,
      totalOpenTasks,
      recentActivity: {
        newUsersLast7Days,
        newPropertiesLast7Days,
        newTicketsLast7Days,
        transactionsLast7Days,
      },
    };
  }

  async getLandlordsList() {
    return this.landlordModel
      .find({ deleted: { $ne: true } })
      .select('_id name createdAt')
      .sort({ name: 1 })
      .lean();
  }
}
