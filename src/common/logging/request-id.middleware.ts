import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from './constants/logging.constants';
import type { RequestWithRequestId } from './types/request-with-request-id.type';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: RequestWithRequestId,
    response: Response,
    next: NextFunction,
  ): void {
    const requestId = this.getIncomingRequestId(request) ?? randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }

  private getIncomingRequestId(request: Request): string | undefined {
    const requestId = request.header(REQUEST_ID_HEADER)?.trim();

    if (!requestId) {
      return undefined;
    }

    return requestId.slice(0, 128);
  }
}
