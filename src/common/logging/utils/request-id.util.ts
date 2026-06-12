import type { RequestWithRequestId } from '../types/request-with-request-id.type';

export function getRequestId(
  request: RequestWithRequestId,
): string | undefined {
  return request.requestId;
}
