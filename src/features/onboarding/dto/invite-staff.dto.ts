import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteStaffDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
