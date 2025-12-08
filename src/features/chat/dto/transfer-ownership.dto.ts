import { IsMongoId, IsNotEmpty } from 'class-validator';

export class TransferOwnershipDto {
  @IsNotEmpty()
  @IsMongoId()
  newOwnerId: string;
}
