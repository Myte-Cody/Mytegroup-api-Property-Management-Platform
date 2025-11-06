import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Transaction, TransactionSchema } from '../leases/schemas/transaction.schema';
import { Invoice, InvoiceSchema } from '../maintenance/schemas/invoice.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkSchema } from '../maintenance/schemas/scope-of-work.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { FinancialKPIController } from './controllers/financial-kpi.controller';
import { FinancialKPIService } from './services/financial-kpi.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
    ]),
  ],
  controllers: [FinancialKPIController],
  providers: [FinancialKPIService],
  exports: [FinancialKPIService],
})
export class KPIModule {}
