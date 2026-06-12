import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './constants/logging.constants';
import { RequestIdMiddleware } from './request-id.middleware';
import type { RequestWithRequestId } from './types/request-with-request-id.type';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let response: Pick<Response, 'setHeader'>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    response = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it('reuses an incoming request id', () => {
    const request = createRequest('request-from-client');

    middleware.use(request, response as Response, next);

    expect(request.requestId).toBe('request-from-client');
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'request-from-client',
    );
    expect(next).toHaveBeenCalled();
  });

  it('generates a request id when one is not provided', () => {
    const request = createRequest();

    middleware.use(request, response as Response, next);

    expect(request.requestId).toEqual(expect.any(String));
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      request.requestId,
    );
    expect(next).toHaveBeenCalled();
  });

  function createRequest(requestId?: string): RequestWithRequestId {
    return {
      header: jest.fn((name: string) =>
        name === REQUEST_ID_HEADER ? requestId : undefined,
      ),
    } as unknown as Request;
  }
});
