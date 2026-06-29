const {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} = require('@aws-sdk/client-dynamodb');

const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566';
const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.DYNAMODB_TABLE_NAME || 'nestjs-modular-local';

const client = new DynamoDBClient({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'localstack',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'localstack',
  },
});

async function main() {
  if (await tableExists()) {
    console.log(`DynamoDB table already exists: ${tableName}`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [
        {
          AttributeName: 'pk',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'pk',
          KeyType: 'HASH',
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );

  await waitUntilActive();
  console.log(`Created DynamoDB table: ${tableName}`);
}

async function tableExists() {
  try {
    await client.send(
      new DescribeTableCommand({
        TableName: tableName,
      }),
    );

    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }

    throw error;
  }
}

async function waitUntilActive() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const result = await client.send(
      new DescribeTableCommand({
        TableName: tableName,
      }),
    );

    if (result.Table?.TableStatus === 'ACTIVE') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for DynamoDB table: ${tableName}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
