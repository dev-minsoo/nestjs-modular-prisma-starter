import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('returns undefined when no request context exists', () => {
    expect(service.getRequestId()).toBeUndefined();
    expect(service.getCurrentUser()).toBeUndefined();
  });

  it('keeps context values inside the async execution chain', async () => {
    const first = service.run({ requestId: 'request-1' }, async () => {
      await wait(10);

      return service.getRequestId();
    });
    const second = service.run({ requestId: 'request-2' }, async () => {
      await wait(0);

      return service.getRequestId();
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      'request-1',
      'request-2',
    ]);
  });

  it('stores the authenticated user in the current request context', () => {
    service.run({ requestId: 'request-1' }, () => {
      service.setCurrentUser({
        id: 'user-1',
        email: 'minsoo@example.com',
        role: 'ADMIN',
      });

      expect(service.getCurrentUser()).toEqual({
        id: 'user-1',
        email: 'minsoo@example.com',
        role: 'ADMIN',
      });
      expect(service.getLogMetadata()).toEqual({
        requestId: 'request-1',
        currentUserId: 'user-1',
        currentUserRole: 'ADMIN',
      });
    });
  });

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
});
