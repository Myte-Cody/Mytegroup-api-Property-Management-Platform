import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { NotificationType } from '@shared/notification-types';

export class PreferenceChannelsDto {
  @ApiProperty({
    description: 'Enable in-app notifications for this notification type',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @ApiProperty({
    description: 'Enable email notifications for this notification type',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiProperty({
    description: 'Enable SMS notifications for this notification type',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

export class NotificationPreferenceItemDto {
  @ApiProperty({
    description: 'The notification type to update',
    enum: NotificationType,
    example: NotificationType.MAINTENANCE_NEW_REQUEST,
  })
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @ApiProperty({
    description: 'Enable in-app notifications for this notification type',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @ApiProperty({
    description: 'Enable email notifications for this notification type',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiProperty({
    description: 'Enable SMS notifications for this notification type',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Array of notification preferences to update',
    type: [NotificationPreferenceItemDto],
    example: [
      {
        notificationType: 'maintenance_new_request',
        inApp: true,
        email: true,
        sms: false,
      },
      {
        notificationType: 'lease_activated',
        inApp: true,
        email: false,
        sms: false,
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences: NotificationPreferenceItemDto[];
}
