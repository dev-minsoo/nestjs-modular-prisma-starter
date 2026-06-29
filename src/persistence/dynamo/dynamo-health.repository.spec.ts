import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { ConfigService } from '@nestjs/config';
import { DynamoHealthRepository } from './dynamo-health.repository';

describe('DynamoHealthRepository', () => {
  let repository: DynamoHealthRepository;
  let dynamodb: {
    send: jest.Mock;
  };

  beforeEach(() => {
    dynamodb = {
      send: jest.fn(),
    };
    repository = new DynamoHealthRepository(
      dynamodb as unknown as DynamoDBClient,
      createConfigService(),
    );
  });

  it('returns true when the table can be described', async () => {
    dynamodb.send.mockResolvedValue({});

    await expect(repository.checkDatabase()).resolves.toBe(true);

    const command = dynamodb.send.mock.calls[0][0] as DescribeTableCommand;
    expect(command).toBeInstanceOf(DescribeTableCommand);
    expect(command.input.TableName).toBe('test-table');
  });

  it('returns false when DynamoDB rejects the check', async () => {
    dynamodb.send.mockRejectedValue(new Error('table missing'));

    await expect(repository.checkDatabase()).resolves.toBe(false);
  });
});

function createConfigService(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'DYNAMODB_TABLE_NAME') {
        return 'test-table';
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService;
}
