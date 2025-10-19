import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum VoteType {
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote',
  REMOVE = 'remove',
}

export class VotePostDto {
  @ApiProperty({
    description: 'Vote type',
    enum: VoteType,
    example: VoteType.UPVOTE,
  })
  @IsEnum(VoteType)
  @IsNotEmpty()
  voteType: VoteType;
}
