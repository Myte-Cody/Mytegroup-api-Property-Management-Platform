import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskPriority } from '../../../common/enums/task.enum';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Property ID where the task belongs',
    example: '673d8b8f123456789abcdef0',
  })
  @IsMongoId()
  @IsNotEmpty()
  property: string;

  @ApiPropertyOptional({
    description: 'Unit ID (optional)',
    example: '673d8b8f123456789abcdef1',
  })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Tenant ID to link this task to',
    example: '673d8b8f123456789abcdef2',
  })
  @IsOptional()
  @IsMongoId()
  tenant?: string;

  @ApiProperty({
    description: 'Brief title/summary of the task',
    example: 'Schedule annual inspection',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the task',
    example: 'Contact tenant to schedule the annual property inspection...',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    description: 'Priority level of the task',
    enum: TaskPriority,
    example: TaskPriority.MEDIUM,
    default: TaskPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'User ID of the assigned party',
    example: '673d8b8f123456789abcdef3',
  })
  @IsOptional()
  @IsMongoId()
  assignedParty?: string;

  @ApiPropertyOptional({
    description: 'Additional notes or comments',
    example: 'Tenant prefers weekday mornings',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
