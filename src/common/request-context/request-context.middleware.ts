import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithRequestId } from '../logging/types/request-with-request-id.type';
import { getRequestId } from '../logging/utils/request-id.util';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(
    request: RequestWithRequestId,
    _response: Response,
    next: NextFunction,
  ): void {
    this.requestContext.run(
      {
        requestId: getRequestId(request),
        method: request.method,
        path: request.originalUrl || request.url,
      },
      () => next(),
    );
  }
}
