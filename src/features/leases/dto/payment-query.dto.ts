import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';

export class PaymentQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'dueDate',
    default: 'dueDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'dueDate';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment type',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @ApiPropertyOptional({
    description: 'Filter by lease ID',
    example: '673d8b8f123456789abcdef0',
  })
  @IsOptional()
  @IsMongoId()
  leaseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by rental period ID',
    example: '673d8b8f123456789abcdef1',
  })
  @IsOptional()
  @IsMongoId()
  rentalPeriodId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Filter payments due from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter payments due up to this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter payments paid from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  paidAtFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter payments paid up to this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  paidAtTo?: Date;
}
