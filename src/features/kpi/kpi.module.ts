import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import { Transaction, TransactionSchema } from '../leases/schemas/transaction.schema';
import { Invoice, InvoiceSchema } from '../maintenance/schemas/invoice.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkSchema } from '../maintenance/schemas/scope-of-work.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FinancialKPIController } from './controllers/financial-kpi.controller';
import { MaintenanceKPIController } from './controllers/maintenance-kpi.controller';
import { OccupancyLeasingKPIController } from './controllers/occupancy-leasing-kpi.controller';
import { FinancialKPIService } from './services/financial-kpi.service';
import { MaintenanceKPIService } from './services/maintenance-kpi.service';
import { OccupancyLeasingKPIService } from './services/occupancy-leasing-kpi.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FinancialKPIController, OccupancyLeasingKPIController, MaintenanceKPIController],
  providers: [FinancialKPIService, OccupancyLeasingKPIService, MaintenanceKPIService],
  exports: [FinancialKPIService, OccupancyLeasingKPIService, MaintenanceKPIService],
})
export class KPIModule {}
