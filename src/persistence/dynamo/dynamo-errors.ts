export function isConditionalWriteFailure(error: unknown): boolean {
  const errorName =
    typeof error === 'object' && error !== null && 'name' in error
      ? String(error.name)
      : undefined;

  return (
    errorName === 'ConditionalCheckFailedException' ||
    errorName === 'TransactionCanceledException'
  );
}
