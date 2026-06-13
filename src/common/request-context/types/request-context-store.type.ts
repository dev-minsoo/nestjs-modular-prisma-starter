import type { RequestContextUser } from './request-context-user.type';

export type RequestContextStore = {
  requestId?: string;
  method?: string;
  path?: string;
  currentUser?: RequestContextUser;
};
