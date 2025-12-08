import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @ApiProperty({
    example: true,
    description:
      'Allow neighbors to send direct messages. When OFF, other users cannot start new chats.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  allowNeighborsToMessage?: boolean;

  @ApiProperty({
    example: true,
    description:
      'Allow others to add you to group chats. When OFF, you cannot be added to private groups. Exception: Property-wide and building/admin groups override this setting.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  allowGroupChatInvites?: boolean;
}
