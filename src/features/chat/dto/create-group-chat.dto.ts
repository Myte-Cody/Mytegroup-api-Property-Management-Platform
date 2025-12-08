import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateGroupChatDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  participantIds: string[];

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
