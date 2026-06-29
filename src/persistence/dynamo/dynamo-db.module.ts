import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DYNAMODB_CLIENT = Symbol('DYNAMODB_CLIENT');
export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DYNAMODB_DOCUMENT_CLIENT');

@Module({
  providers: [
    {
      provide: DYNAMODB_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('DYNAMODB_ENDPOINT');
        const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );

        return new DynamoDBClient({
          region: configService.getOrThrow<string>('AWS_REGION'),
          endpoint,
          credentials:
            accessKeyId && secretAccessKey
              ? {
                  accessKeyId,
                  secretAccessKey,
                }
              : endpoint
                ? {
                    accessKeyId: 'localstack',
                    secretAccessKey: 'localstack',
                  }
                : undefined,
        });
      },
    },
    {
      provide: DYNAMODB_DOCUMENT_CLIENT,
      inject: [DYNAMODB_CLIENT],
      useFactory: (client: DynamoDBClient) =>
        DynamoDBDocumentClient.from(client, {
          marshallOptions: {
            removeUndefinedValues: true,
          },
        }),
    },
  ],
  exports: [DYNAMODB_CLIENT, DYNAMODB_DOCUMENT_CLIENT],
})
export class DynamoDbModule {}
