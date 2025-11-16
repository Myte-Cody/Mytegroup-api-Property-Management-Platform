import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketStatus } from '../../../common/enums/maintenance.enum';
import { CreateTicketDto } from './create-ticket.dto';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @ApiPropertyOptional({
    description: 'Update ticket status',
    enum: TicketStatus,
    example: TicketStatus.IN_PROGRESS,
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({
    description: 'Contractor assigned to this ticket',
    example: '673d8b8f123456789abcdef3',
  })
  @IsOptional()
  @IsMongoId()
  assignedContractor?: string;

  @ApiPropertyOptional({
    description: 'Date when ticket was assigned',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  assignedDate?: Date;

  @ApiPropertyOptional({
    description: 'Date when work was completed',
    example: '2024-01-20T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completedDate?: Date;

  @ApiPropertyOptional({
    description: 'Internal notes (landlord/contractor only)',
    example: 'Parts ordered, work scheduled for Monday',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
