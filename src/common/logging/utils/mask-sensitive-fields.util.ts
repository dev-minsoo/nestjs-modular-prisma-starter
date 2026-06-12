const MASKED_VALUE = '[masked]';

const SENSITIVE_FIELD_NAMES = new Set([
  'authorization',
  'cookie',
  'setcookie',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'secret',
]);

export function maskSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveFields(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      isSensitiveField(key) ? MASKED_VALUE : maskSensitiveFields(fieldValue),
    ]),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isSensitiveField(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');

  return SENSITIVE_FIELD_NAMES.has(normalizedKey);
}
