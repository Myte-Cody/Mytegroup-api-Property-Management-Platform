import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateExpensePolicyHandler,
  DeleteExpensePolicyHandler,
  ReadExpensePolicyHandler,
  UpdateExpensePolicyHandler,
} from '../../../common/casl/policies/expense.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { User } from '../../users/schemas/user.schema';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { ExpenseQueryDto } from '../dto/expense-query.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import { ExpensesService } from '../services/expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
@UseGuards(CaslGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @CheckPolicies(new CreateExpensePolicyHandler())
  @ApiOperation({ summary: 'Create a new expense' })
  @ApiResponse({ status: 201, description: 'Expense created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createExpenseDto: CreateExpenseDto, @CurrentUser() user: User) {
    const expense = await this.expensesService.create(createExpenseDto, user);
    return {
      success: true,
      data: expense,
    };
  }

  @Get()
  @CheckPolicies(new ReadExpensePolicyHandler())
  @ApiOperation({ summary: 'Get all expenses (including invoices)' })
  @ApiResponse({ status: 200, description: 'Expenses retrieved successfully' })
  async findAll(@Query() query: ExpenseQueryDto) {
    const result = await this.expensesService.findAll(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @CheckPolicies(new ReadExpensePolicyHandler())
  @ApiOperation({ summary: 'Get a specific expense by ID' })
  @ApiResponse({ status: 200, description: 'Expense retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async findOne(@Param('id', MongoIdValidationPipe) id: string) {
    const expense = await this.expensesService.findOne(id);
    return {
      success: true,
      data: expense,
    };
  }

  @Patch(':id')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @CheckPolicies(new UpdateExpensePolicyHandler())
  @ApiOperation({ summary: 'Update an expense' })
  @ApiResponse({ status: 200, description: 'Expense updated successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @CurrentUser() user: User,
  ) {
    const expense = await this.expensesService.update(id, updateExpenseDto, user);
    return {
      success: true,
      data: expense,
    };
  }

  @Delete(':id')
  @CheckPolicies(new DeleteExpensePolicyHandler())
  @ApiOperation({ summary: 'Delete an expense' })
  @ApiResponse({ status: 200, description: 'Expense deleted successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id', MongoIdValidationPipe) id: string) {
    await this.expensesService.remove(id);
    return {
      success: true,
      message: 'Expense deleted successfully',
    };
  }

  @Patch(':id/confirm')
  @CheckPolicies(new UpdateExpensePolicyHandler())
  @ApiOperation({ summary: 'Confirm an expense (change status to Confirmed)' })
  @ApiResponse({ status: 200, description: 'Expense confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., already confirmed or is an invoice)',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async confirm(@Param('id', MongoIdValidationPipe) id: string) {
    const expense = await this.expensesService.confirm(id);
    return {
      success: true,
      data: expense,
      message: 'Expense confirmed successfully',
    };
  }
}
