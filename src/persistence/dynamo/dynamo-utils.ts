import { ScanCommand, type ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export async function scanAllItems<T>(
  documentClient: DynamoDBDocumentClient,
  input: ScanCommandInput,
): Promise<T[]> {
  const items: T[] = [];
  let exclusiveStartKey = input.ExclusiveStartKey;

  do {
    const result = await documentClient.send(
      new ScanCommand({
        ...input,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...((result.Items ?? []) as T[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

export function compareValues(
  left: Date | boolean | string | null,
  right: Date | boolean | string | null,
): number {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }

  return String(left ?? '').localeCompare(String(right ?? ''));
}
