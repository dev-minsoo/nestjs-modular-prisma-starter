import { PaginationQueryDto } from '../dto/pagination-query.dto';
import {
  createPaginatedResult,
  createPaginationMeta,
  getPaginationParams,
} from './pagination.util';

describe('pagination utilities', () => {
  it('calculates skip and take from a pagination query', () => {
    const query: PaginationQueryDto = {
      page: 3,
      pageSize: 10,
    };

    expect(getPaginationParams(query)).toEqual({
      skip: 20,
      take: 10,
    });
  });

  it('creates pagination metadata', () => {
    const query: PaginationQueryDto = {
      page: 2,
      pageSize: 5,
    };

    expect(createPaginationMeta(query, 12)).toEqual({
      page: 2,
      pageSize: 5,
      total: 12,
      totalPages: 3,
    });
  });

  it('creates a paginated result', () => {
    const query: PaginationQueryDto = {
      page: 1,
      pageSize: 20,
    };
    const items = [{ id: 'user-id' }];

    expect(createPaginatedResult(items, 1, query)).toEqual({
      items,
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });
});
