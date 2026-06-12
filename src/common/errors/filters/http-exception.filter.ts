import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { getRequestId } from '../../logging';
import type { RequestWithRequestId } from '../../logging';
import type { ErrorResponseDto } from '../dto/error-response.dto';
import type { ErrorCode } from '../types/error-code.type';

type HttpExceptionResponseBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithRequestId>();
    const statusCode = exception.getStatus();

    response.status(statusCode).json(
      this.createErrorResponse({
        exception,
        statusCode,
        path: request.originalUrl || request.url,
        requestId: getRequestId(request),
      }),
    );
  }

  private createErrorResponse({
    exception,
    statusCode,
    path,
    requestId,
  }: {
    exception: HttpException;
    statusCode: HttpStatus;
    path: string;
    requestId?: string;
  }): ErrorResponseDto {
    const exceptionResponse = exception.getResponse();
    const responseBody = this.parseExceptionResponse(exceptionResponse);
    const details = this.extractDetails(responseBody);

    return {
      statusCode,
      code: this.resolveErrorCode(statusCode, responseBody, details),
      message: this.resolveMessage(exception, responseBody, details),
      path,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      ...(details ? { details } : {}),
    };
  }

  private parseExceptionResponse(
    exceptionResponse: string | object,
  ): HttpExceptionResponseBody {
    if (typeof exceptionResponse === 'string') {
      return {
        message: exceptionResponse,
      };
    }

    if (this.isHttpExceptionResponseBody(exceptionResponse)) {
      return exceptionResponse;
    }

    return {};
  }

  private isHttpExceptionResponseBody(
    value: object,
  ): value is HttpExceptionResponseBody {
    return (
      'message' in value ||
      'error' in value ||
      'statusCode' in value ||
      'code' in value
    );
  }

  private extractDetails(
    responseBody: HttpExceptionResponseBody,
  ): string[] | undefined {
    if (Array.isArray(responseBody.message)) {
      return responseBody.message;
    }

    return undefined;
  }

  private resolveMessage(
    exception: HttpException,
    responseBody: HttpExceptionResponseBody,
    details?: string[],
  ): string {
    if (details) {
      return 'Validation failed';
    }

    if (typeof responseBody.message === 'string') {
      return responseBody.message;
    }

    if (responseBody.error) {
      return responseBody.error;
    }

    return exception.message;
  }

  private resolveErrorCode(
    statusCode: HttpStatus,
    responseBody: HttpExceptionResponseBody,
    details?: string[],
  ): ErrorCode {
    if (details) {
      return 'VALIDATION_FAILED';
    }

    if (this.isErrorCode(responseBody.code)) {
      return responseBody.code;
    }

    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }

  private isErrorCode(value: unknown): value is ErrorCode {
    return (
      value === 'BAD_REQUEST' ||
      value === 'VALIDATION_FAILED' ||
      value === 'UNAUTHORIZED' ||
      value === 'FORBIDDEN' ||
      value === 'NOT_FOUND' ||
      value === 'CONFLICT' ||
      value === 'UNPROCESSABLE_ENTITY' ||
      value === 'INTERNAL_SERVER_ERROR'
    );
  }
}
