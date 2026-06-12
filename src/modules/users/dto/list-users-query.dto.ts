import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const USER_LIST_ORDER_BY = [
  'createdAt',
  'updatedAt',
  'email',
  'name',
] as const;
export const USER_LIST_ORDER_DIRECTION = ['asc', 'desc'] as const;

export type UserListOrderBy = (typeof USER_LIST_ORDER_BY)[number];
export type UserListOrderDirection = (typeof USER_LIST_ORDER_DIRECTION)[number];

export class ListUsersQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ example: 'minsoo', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: USER_LIST_ORDER_BY,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(USER_LIST_ORDER_BY)
  orderBy: UserListOrderBy = 'createdAt';

  @ApiPropertyOptional({
    enum: USER_LIST_ORDER_DIRECTION,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(USER_LIST_ORDER_DIRECTION)
  orderDirection: UserListOrderDirection = 'desc';
}
