import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../../config/environment';
import type { LogMetadata } from './types/log-metadata.type';
import { maskSensitiveFields } from './utils/mask-sensitive-fields.util';

type LogLevel = 'debug' | 'error' | 'info' | 'verbose' | 'warn';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly appEnv: AppEnvironment;

  constructor(private readonly configService: ConfigService) {
    this.appEnv = this.configService.get<AppEnvironment>('APP_ENV', 'local');
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(
    message: unknown,
    trace?: string,
    context?: string,
    metadata?: LogMetadata,
  ): void {
    this.write('error', message, context, {
      ...metadata,
      ...(trace ? { trace } : {}),
    });
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  info(message: unknown, metadata?: LogMetadata, context?: string): void {
    this.write('info', message, context, metadata);
  }

  warnWithMetadata(
    message: unknown,
    metadata?: LogMetadata,
    context?: string,
  ): void {
    this.write('warn', message, context, metadata);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    metadata: LogMetadata = {},
  ): void {
    const timestamp = new Date().toISOString();
    const logMessage = this.formatMessage(message);
    const safeMetadata = this.cleanMetadata(maskSensitiveFields(metadata));

    if (this.appEnv === 'local') {
      this.writePrettyLog({
        timestamp,
        level,
        message: logMessage,
        context,
        metadata: safeMetadata,
      });
      return;
    }

    this.writeJsonLog({
      ...safeMetadata,
      timestamp,
      level,
      message: logMessage,
      ...(context ? { context } : {}),
    });
  }

  private writePrettyLog(entry: {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: string;
    metadata: LogMetadata;
  }): void {
    const context = entry.context ? ` [${entry.context}]` : '';
    const metadata = this.formatPrettyMetadata(entry.metadata);
    const line = `${entry.timestamp} ${entry.level.toUpperCase()}${context} ${entry.message}${metadata}`;

    this.writeToConsole(entry.level, line);
  }

  private writeJsonLog(entry: LogMetadata): void {
    const level = entry.level === 'error' ? 'error' : entry.level;

    this.writeToConsole(level as LogLevel, JSON.stringify(entry));
  }

  private formatPrettyMetadata(metadata: LogMetadata): string {
    const details = Object.entries(metadata)
      .map(([key, value]) => `${key}=${this.formatMetadataValue(value)}`)
      .join(' ');

    return details ? ` ${details}` : '';
  }

  private formatMetadataValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value) ?? String(value);
  }

  private formatMessage(message: unknown): string {
    if (message instanceof Error) {
      return message.message;
    }

    if (typeof message === 'string') {
      return message;
    }

    return JSON.stringify(message) ?? String(message);
  }

  private cleanMetadata(value: unknown): LogMetadata {
    if (!this.isRecord(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter(
        ([, fieldValue]) => fieldValue !== undefined,
      ),
    );
  }

  private isRecord(value: unknown): value is LogMetadata {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private writeToConsole(level: LogLevel, line: string): void {
    if (level === 'error') {
      console.error(line);
      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  }
}
