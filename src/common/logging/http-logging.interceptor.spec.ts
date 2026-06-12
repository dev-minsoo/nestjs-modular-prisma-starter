import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AppLogger } from './app-logger.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  let logger: Pick<AppLogger, 'error' | 'info' | 'warnWithMetadata'>;
  let interceptor: HttpLoggingInterceptor;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      info: jest.fn(),
      warnWithMetadata: jest.fn(),
    };
    interceptor = new HttpLoggingInterceptor(logger as AppLogger);
  });

  it('logs HTTP request start and completion', async () => {
    const context = createExecutionContext({
      responseStatusCode: 200,
      requestId: 'request-1',
    });
    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      ok: true,
    });

    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'HTTP request started',
      {
        requestId: 'request-1',
        method: 'GET',
        path: '/api/health',
      },
      'HttpLoggingInterceptor',
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      'HTTP request completed',
      expect.objectContaining({
        requestId: 'request-1',
        method: 'GET',
        path: '/api/health',
        statusCode: 200,
        durationMs: expect.any(Number) as unknown,
      }),
      'HttpLoggingInterceptor',
    );
  });

  it('logs server errors and rethrows the error', async () => {
    const error = new InternalServerErrorException('Something failed');
    const context = createExecutionContext({
      responseStatusCode: 200,
      requestId: 'request-2',
    });
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith(
      'HTTP request failed',
      error.stack,
      'HttpLoggingInterceptor',
      expect.objectContaining({
        requestId: 'request-2',
        method: 'GET',
        path: '/api/health',
        statusCode: 500,
        durationMs: expect.any(Number) as unknown,
        errorName: 'InternalServerErrorException',
      }),
    );
  });

  it('logs client errors as warnings and rethrows the error', async () => {
    const error = new BadRequestException('Invalid request');
    const context = createExecutionContext({
      responseStatusCode: 200,
      requestId: 'request-3',
    });
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(logger.warnWithMetadata).toHaveBeenCalledWith(
      'HTTP request failed',
      expect.objectContaining({
        requestId: 'request-3',
        method: 'GET',
        path: '/api/health',
        statusCode: 400,
        durationMs: expect.any(Number) as unknown,
        errorName: 'BadRequestException',
      }),
      'HttpLoggingInterceptor',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  function createExecutionContext({
    requestId,
    responseStatusCode,
  }: {
    requestId: string;
    responseStatusCode: number;
  }): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          requestId,
          method: 'GET',
          originalUrl: '/api/health',
          url: '/health',
        }),
        getResponse: () => ({
          statusCode: responseStatusCode,
        }),
      }),
    } as ExecutionContext;
  }
});
