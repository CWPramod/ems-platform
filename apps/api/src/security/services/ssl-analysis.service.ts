import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SslCertificate,
  CertificateStatus,
} from '../../entities/ssl-certificate.entity';

@Injectable()
export class SslAnalysisService {
  constructor(
    @InjectRepository(SslCertificate)
    private sslRepo: Repository<SslCertificate>,
  ) {}

  async getCertificates(filters?: {
    status?: CertificateStatus;
    hostname?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SslCertificate[]; total: number }> {
    const qb = this.sslRepo.createQueryBuilder('cert');

    if (filters?.status) {
      qb.andWhere('cert.status = :status', { status: filters.status });
    }
    if (filters?.hostname) {
      qb.andWhere('cert.hostname ILIKE :hostname', {
        hostname: `%${filters.hostname}%`,
      });
    }

    qb.orderBy('cert.expires_at', 'ASC');
    const total = await qb.getCount();
    qb.take(filters?.limit || 50).skip(filters?.offset || 0);
    const data = await qb.getMany();

    return { data, total };
  }

  async getCertificateById(id: string): Promise<SslCertificate | null> {
    return this.sslRepo.findOne({ where: { id } });
  }

  async getSummary(): Promise<any> {
    const total = await this.sslRepo.count();
    const valid = await this.sslRepo.count({
      where: { status: CertificateStatus.VALID },
    });
    const expired = await this.sslRepo.count({
      where: { status: CertificateStatus.EXPIRED },
    });
    const expiringSoon = await this.sslRepo.count({
      where: { status: CertificateStatus.EXPIRING_SOON },
    });
    const selfSigned = await this.sslRepo.count({
      where: { status: CertificateStatus.SELF_SIGNED },
    });
    const invalid = await this.sslRepo.count({
      where: { status: CertificateStatus.INVALID },
    });
    const revoked = await this.sslRepo.count({
      where: { status: CertificateStatus.REVOKED },
    });

    // Average security score
    const scoreResult = await this.sslRepo
      .createQueryBuilder('cert')
      .select('AVG(cert.security_score)', 'avgScore')
      .getRawOne();

    return {
      total,
      valid,
      expired,
      expiringSoon,
      selfSigned,
      invalid,
      revoked,
      averageSecurityScore: Math.round(parseFloat(scoreResult?.avgScore || '0')),
      statusBreakdown: [
        { status: 'valid', count: valid },
        { status: 'expired', count: expired },
        { status: 'expiring_soon', count: expiringSoon },
        { status: 'self_signed', count: selfSigned },
        { status: 'invalid', count: invalid },
        { status: 'revoked', count: revoked },
      ],
    };
  }

  async scanHost(hostname: string, port: number = 443): Promise<any> {
    return {
      message: `SSL scan initiated for ${hostname}:${port}`,
      hostname,
      port,
      status: 'scanning',
    };
  }
}
