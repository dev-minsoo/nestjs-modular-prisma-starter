import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination';

export const USER_LIST_ORDER_BY = [
  'createdAt',
  'updatedAt',
  'email',
  'name',
] as const;
export const USER_LIST_ORDER_DIRECTION = ['asc', 'desc'] as const;

export type UserListOrderBy = (typeof USER_LIST_ORDER_BY)[number];
export type UserListOrderDirection = (typeof USER_LIST_ORDER_DIRECTION)[number];

export class ListUsersQueryDto extends PaginationQueryDto {
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
