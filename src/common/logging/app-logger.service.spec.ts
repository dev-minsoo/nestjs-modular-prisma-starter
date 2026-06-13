import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../request-context';
import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let consoleLog: jest.SpyInstance;
  let requestContext: RequestContextService;
  let logger: AppLogger;

  beforeEach(() => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation();
    requestContext = new RequestContextService();
    logger = new AppLogger(
      {
        get: jest.fn().mockReturnValue('dev'),
      } as unknown as ConfigService,
      requestContext,
    );
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it('adds request context metadata to JSON logs', () => {
    requestContext.run(
      {
        requestId: 'request-1',
        currentUser: {
          id: 'user-1',
          email: 'minsoo@example.com',
          role: 'ADMIN',
        },
      },
      () => {
        logger.info('User updated', { domain: 'users' }, 'UsersService');
      },
    );

    expect(getLoggedJson()).toEqual(
      expect.objectContaining({
        requestId: 'request-1',
        currentUserId: 'user-1',
        currentUserRole: 'ADMIN',
        domain: 'users',
        timestamp: expect.any(String) as unknown,
        level: 'info',
        message: 'User updated',
        context: 'UsersService',
      }),
    );
  });

  it('lets explicit metadata override request context metadata', () => {
    requestContext.run({ requestId: 'request-1' }, () => {
      logger.info('Manual request id', { requestId: 'explicit-request' });
    });

    expect(getLoggedJson()).toEqual(
      expect.objectContaining({
        requestId: 'explicit-request',
      }),
    );
  });

  function getLoggedJson(): Record<string, unknown> {
    const calls = consoleLog.mock.calls as unknown[][];
    const line = calls[0]?.[0];

    if (typeof line !== 'string') {
      throw new Error('Expected a JSON log line');
    }

    const parsed: unknown = JSON.parse(line);

    if (!isRecord(parsed)) {
      throw new Error('Expected a JSON object log line');
    }

    return parsed;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
});
