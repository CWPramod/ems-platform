import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProbeApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-probe-api-key'];
    const expectedKey = this.configService.get<string>('PROBE_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('Probe API key not configured on server');
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing probe API key');
    }

    return true;
  }
}
