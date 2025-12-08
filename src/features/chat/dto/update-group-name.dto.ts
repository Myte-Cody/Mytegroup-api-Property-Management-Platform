import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateGroupNameDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;
}
