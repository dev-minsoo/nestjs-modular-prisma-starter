import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTodoDto {
  @ApiPropertyOptional({ example: 'Read the Prisma docs', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    example: 'Focus on relations and migrations.',
    nullable: true,
    maxLength: 1_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
