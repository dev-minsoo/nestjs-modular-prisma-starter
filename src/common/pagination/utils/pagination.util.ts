import { PaginationMetaDto } from '../dto/pagination-meta.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedResult } from '../types/paginated-result.type';

export type PaginationParams = {
  skip: number;
  take: number;
};

export function getPaginationParams(
  query: PaginationQueryDto,
): PaginationParams {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

export function createPaginationMeta(
  query: PaginationQueryDto,
  total: number,
): PaginationMetaDto {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): PaginatedResult<T> {
  return {
    items,
    meta: createPaginationMeta(query, total),
  };
}
