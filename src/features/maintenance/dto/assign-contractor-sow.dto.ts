import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AssignContractorSowDto {
  @ApiProperty({
    description: 'Contractor ID to assign to the scope of work',
    example: '673d8b8f123456789abcdef3',
  })
  @IsMongoId()
  @IsNotEmpty()
  contractorId: string;
}
