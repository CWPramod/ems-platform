import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ProbeApiKeyGuard } from './guards/api-key.guard';
import { ProbeService } from './probe.service';
import { ProbePayloadDto } from './dto/probe-payload.dto';

@Controller('api/v1/probe')
@SkipThrottle()
export class ProbeController {
  private readonly logger = new Logger(ProbeController.name);

  constructor(private readonly probeService: ProbeService) {}

  @Post('ingest')
  @UseGuards(ProbeApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async ingest(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    payload: ProbePayloadDto,
  ) {
    this.logger.log(`Ingest request from probe: ${payload.probeId}`);
    const result = await this.probeService.ingest(payload);
    return {
      status: 'ok',
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'probe-ingestion',
      probes: this.probeService.getAllProbes(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':probeId/status')
  @UseGuards(ProbeApiKeyGuard)
  getProbeStatus(@Param('probeId') probeId: string) {
    const status = this.probeService.getProbeStatus(probeId);
    if (!status) {
      return {
        status: 'unknown',
        probeId,
        message: 'No data received from this probe yet',
      };
    }
    return { status: 'ok', ...status };
  }
}
