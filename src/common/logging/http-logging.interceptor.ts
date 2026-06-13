import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { RequestContextService, RequestContextUser } from '../request-context';
import { AppLogger } from './app-logger.service';
import type { RequestWithRequestId } from './types/request-with-request-id.type';
import { getRequestId } from './utils/request-id.util';

const SERVER_ERROR_MIN_STATUS = 500;

type RequestWithLoggingContext = RequestWithRequestId & {
  user?: RequestContextUser;
};

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly context = HttpLoggingInterceptor.name;

  constructor(
    private readonly logger: AppLogger,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithLoggingContext>();
    const response = httpContext.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    this.requestContext.setCurrentUser(request.user);

    const requestMetadata = {
      requestId: getRequestId(request),
      method: request.method,
      path: request.originalUrl || request.url,
    };

    this.logger.info('HTTP request started', requestMetadata, this.context);

    return next.handle().pipe(
      tap({
        complete: () => {
          this.logger.info(
            'HTTP request completed',
            {
              ...requestMetadata,
              statusCode: response.statusCode,
              durationMs: this.getDurationMs(startedAt),
            },
            this.context,
          );
        },
      }),
      catchError((error: unknown) => {
        const statusCode = this.getStatusCode(error);
        const errorMetadata = {
          ...requestMetadata,
          statusCode,
          durationMs: this.getDurationMs(startedAt),
          errorName: this.getErrorName(error),
        };

        if (statusCode >= SERVER_ERROR_MIN_STATUS) {
          this.logger.error(
            'HTTP request failed',
            this.getErrorStack(error),
            this.context,
            errorMetadata,
          );
        } else {
          this.logger.warnWithMetadata(
            'HTTP request failed',
            errorMetadata,
            this.context,
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private getDurationMs(startedAt: bigint): number {
    const durationNs = process.hrtime.bigint() - startedAt;

    return Number(durationNs / BigInt(1_000_000));
  }

  private getStatusCode(error: unknown): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorName(error: unknown): string {
    if (error instanceof Error) {
      return error.name;
    }

    return 'UnknownError';
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    return undefined;
  }
}
