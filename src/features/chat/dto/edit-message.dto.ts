import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  content: string;
}
