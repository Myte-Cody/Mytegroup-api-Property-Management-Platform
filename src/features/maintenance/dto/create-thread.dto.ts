import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ThreadLinkedEntityType, ThreadType } from '../schemas/thread.schema';
import { ParticipantType } from '../schemas/thread-participant.schema';

export class ThreadParticipantDto {
  @IsNotEmpty()
  @IsEnum(ParticipantType)
  participantType: ParticipantType;

  @IsNotEmpty()
  @IsMongoId()
  participantId: string;
}

export class CreateThreadDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsNotEmpty()
  @IsEnum(ThreadLinkedEntityType)
  linkedEntityType: ThreadLinkedEntityType;

  @IsNotEmpty()
  @IsMongoId()
  linkedEntityId: string;

  @IsNotEmpty()
  @IsEnum(ThreadType)
  threadType: ThreadType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ThreadParticipantDto)
  participants?: ThreadParticipantDto[];
}
