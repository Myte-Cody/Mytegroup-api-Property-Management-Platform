import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { ThreadLinkedEntityType, ThreadType } from '../schemas/thread.schema';
import { ParticipantStatus } from '../schemas/thread-participant.schema';

export class ThreadQueryDto {
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
    description: 'Filter by linked entity type',
    enum: ThreadLinkedEntityType,
    example: ThreadLinkedEntityType.TICKET,
  })
  @IsOptional()
  @IsEnum(ThreadLinkedEntityType)
  linkedEntityType?: ThreadLinkedEntityType;

  @ApiPropertyOptional({
    description: 'Filter by linked entity ID',
    example: '673d8b8f123456789abcdef0',
  })
  @IsOptional()
  @IsMongoId()
  linkedEntityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by thread type',
    enum: ThreadType,
    example: ThreadType.LANDLORD_TENANT,
  })
  @IsOptional()
  @IsEnum(ThreadType)
  threadType?: ThreadType;

  @ApiPropertyOptional({
    description: 'Filter by participant ID',
    example: '673d8b8f123456789abcdef0',
  })
  @IsOptional()
  @IsMongoId()
  participantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by participant status',
    enum: ParticipantStatus,
    example: ParticipantStatus.ACCEPTED,
  })
  @IsOptional()
  @IsEnum(ParticipantStatus)
  participantStatus?: ParticipantStatus;
}
