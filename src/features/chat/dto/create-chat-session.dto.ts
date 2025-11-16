import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateChatSessionDto {
  @IsNotEmpty()
  @IsMongoId()
  userId: string;
}
