import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { AiModule } from '../ai/ai.module';
import { Invoice, InvoiceSchema } from '../maintenance/schemas/invoice.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkSchema } from '../maintenance/schemas/scope-of-work.schema';
import { MediaModule } from '../media/media.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { ExpensesController } from './controllers/expenses.controller';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { ExpensesService } from './services/expenses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
    NestjsFormDataModule,
    CaslModule,
    MediaModule,
    AiModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
