import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContextStore } from './types/request-context-store.type';
import type { RequestContextUser } from './types/request-context-user.type';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getStore(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.getStore()?.requestId;
  }

  getCurrentUser(): RequestContextUser | undefined {
    return this.getStore()?.currentUser;
  }

  setCurrentUser(currentUser: RequestContextUser | undefined): void {
    const store = this.getStore();

    if (!store || !currentUser) {
      return;
    }

    store.currentUser = currentUser;
  }

  getLogMetadata(): Record<string, unknown> {
    const store = this.getStore();
    const currentUser = store?.currentUser;

    return {
      requestId: store?.requestId,
      currentUserId: currentUser?.id,
      currentUserRole: currentUser?.role,
    };
  }
}
