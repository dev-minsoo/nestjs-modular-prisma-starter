import { PaginationMetaDto } from '../dto/pagination-meta.dto';

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMetaDto;
};
