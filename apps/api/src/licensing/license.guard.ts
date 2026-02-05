import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { LicenseValidationService } from './license-validation.service';

/**
 * Decorator to mark a route as requiring a specific license feature.
 * Usage: @RequiresLicense('cloud') or @RequiresLicense('apm')
 */
export const RequiresLicense = (feature: string) =>
  SetMetadata('license_feature', feature);

/**
 * Guard that checks whether the current license allows access to a feature.
 * Use with @RequiresLicense('feature-name') decorator on controller methods.
 *
 * - If no @RequiresLicense decorator is present, access is allowed.
 * - If the license is expired (past grace period), blocks all requests.
 * - If the feature is not included in the current license tier, blocks the request.
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private validationService: LicenseValidationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      'license_feature',
      [context.getHandler(), context.getClass()],
    );

    // No license requirement on this route
    if (!requiredFeature) {
      return true;
    }

    const validation = await this.validationService.validate();

    // License expired (past grace period) → block everything
    if (!validation.valid) {
      throw new ForbiddenException(
        'License expired. Please renew your license to continue using this feature.',
      );
    }

    // Check if the feature is enabled in the current tier
    const allowed = await this.validationService.isFeatureAllowed(requiredFeature);
    if (!allowed) {
      throw new ForbiddenException(
        `Feature "${requiredFeature}" requires an EMS Full license. ` +
        `Current license tier: ${validation.tier}.`,
      );
    }

    return true;
  }
}
