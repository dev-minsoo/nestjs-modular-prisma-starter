import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  RequestContextMiddleware,
  RequestContextModule,
} from '../request-context';
import { AppLogger } from './app-logger.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  imports: [RequestContextModule],
  providers: [
    AppLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
  exports: [AppLogger],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, RequestContextMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
