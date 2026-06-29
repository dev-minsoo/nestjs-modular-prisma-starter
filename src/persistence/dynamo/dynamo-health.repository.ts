import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthRepository } from '../health.repository';
import { DYNAMODB_CLIENT } from './dynamo-db.module';

@Injectable()
export class DynamoHealthRepository implements HealthRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_CLIENT)
    private readonly dynamodb: DynamoDBClient,
    configService: ConfigService,
  ) {
    this.tableName = configService.getOrThrow<string>('DYNAMODB_TABLE_NAME');
  }

  async checkDatabase(): Promise<boolean> {
    try {
      await this.dynamodb.send(
        new DescribeTableCommand({
          TableName: this.tableName,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }
}
