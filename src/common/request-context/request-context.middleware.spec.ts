import type { NextFunction, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestContextMiddleware', () => {
  let requestContext: RequestContextService;
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    requestContext = new RequestContextService();
    middleware = new RequestContextMiddleware(requestContext);
  });

  it('starts a request context from the request metadata', () => {
    const next = jest.fn(() => {
      expect(requestContext.getStore()).toEqual({
        requestId: 'request-1',
        method: 'GET',
        path: '/api/users',
      });
    });

    middleware.use(
      {
        requestId: 'request-1',
        method: 'GET',
        originalUrl: '/api/users',
        url: '/users',
      } as Parameters<RequestContextMiddleware['use']>[0],
      {} as Response,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalled();
  });
});
