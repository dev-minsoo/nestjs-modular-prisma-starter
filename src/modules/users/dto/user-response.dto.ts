import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '../../../generated/prisma/enums';
import { USER_ROLES } from '../constants/user-roles.constant';

export class UserResponseDto {
  @ApiProperty({ example: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524' })
  id!: string;

  @ApiProperty({ example: 'minsoo@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Minsoo Kim', nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ example: 'USER', enum: USER_ROLES })
  role!: Role;

  @ApiProperty({ example: '2026-06-11T05:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-06-11T05:00:00.000Z' })
  updatedAt!: Date;
}
