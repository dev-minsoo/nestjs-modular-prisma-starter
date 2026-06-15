const { execFileSync } = require('node:child_process');

const CONTAINER_NAME = 'nestjs-modular-prisma-postgres-test';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERVAL_MS = 1_000;

const timeoutMs = Number(
  process.env.TEST_DB_WAIT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
);
const intervalMs = Number(
  process.env.TEST_DB_WAIT_INTERVAL_MS ?? DEFAULT_INTERVAL_MS,
);

async function main() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const healthStatus = getHealthStatus();

    if (healthStatus === 'healthy') {
      console.log(`${CONTAINER_NAME} is healthy`);
      return;
    }

    console.log(`${CONTAINER_NAME} health status: ${healthStatus}`);
    await wait(intervalMs);
  }

  throw new Error(
    `${CONTAINER_NAME} did not become healthy within ${timeoutMs}ms`,
  );
}

function getHealthStatus() {
  try {
    return execFileSync(
      'docker',
      ['inspect', '--format={{.State.Health.Status}}', CONTAINER_NAME],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim();
  } catch {
    return 'unknown';
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
