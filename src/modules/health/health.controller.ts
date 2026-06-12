import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        uptime: 12.34,
        timestamp: '2026-06-11T05:00:00.000Z',
        checks: {
          database: 'ok',
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      example: {
        status: 'error',
        uptime: 12.34,
        timestamp: '2026-06-11T05:00:00.000Z',
        checks: {
          database: 'error',
        },
      },
    },
  })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const health = await this.healthService.getHealth();

    response.status(
      health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return health;
  }
}
