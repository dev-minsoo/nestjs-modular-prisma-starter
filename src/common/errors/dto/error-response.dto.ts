import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ERROR_CODES } from '../types/error-code.type';
import type { ErrorCode } from '../types/error-code.type';

export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'NOT_FOUND', enum: ERROR_CODES })
  code!: ErrorCode;

  @ApiProperty({ example: 'User was not found' })
  message!: string;

  @ApiProperty({ example: '/api/users/2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524' })
  path!: string;

  @ApiProperty({ example: '2026-06-12T05:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({
    example: ['email must be an email'],
    type: String,
    isArray: true,
  })
  details?: string[];
}
