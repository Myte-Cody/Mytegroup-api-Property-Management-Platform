import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { Invoice, InvoiceSchema } from '../maintenance/schemas/invoice.schema';
import { MediaModule } from '../media/media.module';
import { ExpensesController } from './controllers/expenses.controller';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { ExpensesService } from './services/expenses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
    NestjsFormDataModule,
    CaslModule,
    MediaModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
