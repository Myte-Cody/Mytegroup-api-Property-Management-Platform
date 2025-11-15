import { IsEnum, IsMongoId, IsNotEmpty } from 'class-validator';
import { ParticipantType } from '../schemas/thread-participant.schema';

export class DeclineThreadDto {
  @IsNotEmpty()
  @IsEnum(ParticipantType)
  participantType: ParticipantType;

  @IsNotEmpty()
  @IsMongoId()
  participantId: string;
}
