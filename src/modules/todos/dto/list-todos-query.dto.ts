import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination';

export const TODO_LIST_ORDER_BY = [
  'createdAt',
  'updatedAt',
  'title',
  'completed',
] as const;
export const TODO_LIST_ORDER_DIRECTION = ['asc', 'desc'] as const;

export type TodoListOrderBy = (typeof TODO_LIST_ORDER_BY)[number];
export type TodoListOrderDirection = (typeof TODO_LIST_ORDER_DIRECTION)[number];

export class ListTodosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'nestjs', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({
    enum: TODO_LIST_ORDER_BY,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(TODO_LIST_ORDER_BY)
  orderBy: TodoListOrderBy = 'createdAt';

  @ApiPropertyOptional({
    enum: TODO_LIST_ORDER_DIRECTION,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(TODO_LIST_ORDER_DIRECTION)
  orderDirection: TodoListOrderDirection = 'desc';
}

function parseOptionalBoolean(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}
