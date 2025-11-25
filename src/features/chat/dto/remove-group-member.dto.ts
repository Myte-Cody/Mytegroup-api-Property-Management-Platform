import { IsMongoId, IsNotEmpty } from 'class-validator';

export class RemoveGroupMemberDto {
  @IsNotEmpty()
  @IsMongoId()
  userId: string;
}
