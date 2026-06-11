import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524' })
  id!: string;

  @ApiProperty({ example: 'minsoo@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Minsoo Kim', nullable: true })
  name!: string | null;

  @ApiProperty({ example: '2026-06-11T05:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-06-11T05:00:00.000Z' })
  updatedAt!: Date;
}
