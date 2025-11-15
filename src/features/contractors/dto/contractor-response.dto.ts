import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContractorResponseDto {
  @ApiProperty({
    description: 'Contractor ID',
    example: '673d8b8f123456789abcdef0',
  })
  _id: string;

  @ApiProperty({
    description: 'Name of the contractor',
    example: 'ABC Plumbing Services',
  })
  name: string;

  @ApiProperty({
    description: 'Category of the contractor',
    example: 'Plumbing',
  })
  category: string;

  @ApiProperty({
    description: 'Username for the contractor user account',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'First name for the contractor user account',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'Last name for the contractor user account',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'Email address for the contractor user account',
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number for the contractor user account',
    example: '+1234567890',
  })
  phone?: string;

  @ApiProperty({
    description: 'User ID associated with the contractor',
    example: '673d8b8f123456789abcdef1',
  })
  userId: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Number of active maintenance tickets assigned to this contractor',
    example: 5,
  })
  activeTicketsCount: number;

  @ApiProperty({
    description: 'Number of completed maintenance tickets by this contractor',
    example: 12,
  })
  completedTicketsCount: number;
}
