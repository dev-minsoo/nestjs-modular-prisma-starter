import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTodoDto {
  @ApiProperty({ example: 'Read the NestJS docs', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    example: 'Focus on modules, providers, and controllers.',
    maxLength: 1_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;
}
