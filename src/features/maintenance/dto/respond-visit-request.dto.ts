import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum VisitRequestResponse {
  ACCEPT = 'ACCEPT',
  REFUSE = 'REFUSE',
}

export class RespondVisitRequestDto {
  @ApiProperty({
    description: 'Response action (accept or refuse)',
    enum: VisitRequestResponse,
    example: VisitRequestResponse.ACCEPT,
  })
  @IsEnum(VisitRequestResponse)
  @IsNotEmpty()
  response: VisitRequestResponse;

  @ApiPropertyOptional({
    description: 'Optional response message',
    example: 'Looking forward to meeting you',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  responseMessage?: string;
}
