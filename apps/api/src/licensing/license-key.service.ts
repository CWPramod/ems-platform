import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { LicenseType, LicenseTier } from '../entities/license.entity';

@Injectable()
export class LicenseKeyService {
  private readonly signingSecret: string;

  constructor() {
    this.signingSecret =
      process.env.LICENSE_SIGNING_SECRET || 'canaris-license-secret-change-in-production';
  }

  /**
   * Generate a license key in format: CANARIS-{TYPE}-{TIER}-{YYYYMMDD}-{ENCODED_PAYLOAD}
   */
  generateKey(params: {
    type: LicenseType;
    tier: LicenseTier;
    maxDevices: number;
    expiresAt: Date;
  }): string {
    const typeCode = params.type === LicenseType.TRIAL ? 'TRL' :
                     params.type === LicenseType.SUBSCRIPTION ? 'SUB' : 'PRP';
    const tierCode = params.tier === LicenseTier.NMS_ONLY ? 'NMS' : 'EMS';
    const dateCode = params.expiresAt.toISOString().slice(0, 10).replace(/-/g, '');

    const payload = JSON.stringify({
      t: typeCode,
      r: tierCode,
      d: params.maxDevices,
      e: dateCode,
      n: crypto.randomBytes(4).toString('hex'),
    });

    const encoded = Buffer.from(payload).toString('base64url');
    const signature = this.sign(encoded);

    return `CANARIS-${typeCode}-${tierCode}-${dateCode}-${encoded}-${signature}`;
  }

  /**
   * Validate a license key's signature integrity
   */
  validateKeySignature(licenseKey: string): boolean {
    const parts = licenseKey.split('-');
    // CANARIS-TYPE-TIER-DATE-PAYLOAD-SIGNATURE
    if (parts.length < 6 || parts[0] !== 'CANARIS') {
      return false;
    }

    const signature = parts[parts.length - 1];
    const payload = parts[parts.length - 2];

    const expectedSignature = this.sign(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Decode the payload portion of a license key
   */
  decodeKeyPayload(licenseKey: string): {
    type: string;
    tier: string;
    maxDevices: number;
    expiresDate: string;
  } | null {
    try {
      const parts = licenseKey.split('-');
      const payload = parts[parts.length - 2];
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return {
        type: decoded.t,
        tier: decoded.r,
        maxDevices: decoded.d,
        expiresDate: decoded.e,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private sign(data: string): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(data)
      .digest('base64url')
      .substring(0, 16);
  }
}
