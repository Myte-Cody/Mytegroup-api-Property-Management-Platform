import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class RemoveTicketSowDto {
  @ApiProperty({
    description: 'Ticket ID to remove from the scope of work',
    example: '673d8b8f123456789abcdef0',
  })
  @IsMongoId()
  @IsNotEmpty()
  ticketId: string;
}
