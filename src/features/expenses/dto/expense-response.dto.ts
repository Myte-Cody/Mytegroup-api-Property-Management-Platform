import { ApiProperty } from '@nestjs/swagger';

export enum ExpenseSource {
  MAINTENANCE = 'Maintenance',
  MANUAL = 'Manual',
}

export enum ExpenseScope {
  UNIT = 'Unit',
  PROPERTY = 'Property',
}

export class ExpenseResponseDto {
  @ApiProperty({ description: 'Expense ID' })
  _id: string;

  @ApiProperty({ description: 'Property reference' })
  property: any;

  @ApiProperty({ description: 'Unit reference (optional)', required: false })
  unit?: any;

  @ApiProperty({ description: 'Scope of Work reference (optional)', required: false })
  scopeOfWork?: any;

  @ApiProperty({ description: 'Maintenance Ticket reference (optional)', required: false })
  ticket?: any;

  @ApiProperty({ description: 'Expense category' })
  category: string;

  @ApiProperty({ description: 'Expense amount' })
  amount: number;

  @ApiProperty({ description: 'Expense description', required: false })
  description?: string;

  @ApiProperty({ description: 'Expense date' })
  date: Date;

  @ApiProperty({ description: 'Expense status' })
  status: string;

  @ApiProperty({ description: 'Media attachments', required: false })
  media?: any[];

  @ApiProperty({ description: 'Source of expense', enum: ExpenseSource })
  source: ExpenseSource;

  @ApiProperty({ description: 'Scope of expense', enum: ExpenseScope })
  scope: ExpenseScope;

  @ApiProperty({ description: 'Indicates if this is a maintenance invoice', required: false })
  isInvoice?: boolean;

  @ApiProperty({ description: 'Invoice number if applicable', required: false })
  invoiceNumber?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}
