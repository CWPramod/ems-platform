import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SslAnalysisService } from './services/ssl-analysis.service';
import { IocMonitoringService } from './services/ioc-monitoring.service';
import { SignatureDetectionService } from './services/signature-detection.service';
import { DdosDetectionService } from './services/ddos-detection.service';
import { CertificateStatus } from '../entities/ssl-certificate.entity';
import { IocType, IocSeverity, IocStatus } from '../entities/ioc-entry.entity';
import {
  SignatureAlertStatus,
  SignatureCategory,
  SignatureSeverity,
} from '../entities/signature-alert.entity';
import {
  DdosStatus,
  DdosAttackType,
  DdosSeverity,
} from '../entities/ddos-event.entity';

@ApiTags('security')
@Controller('api/v1/security')
export class SecurityController {
  constructor(
    private readonly sslService: SslAnalysisService,
    private readonly iocService: IocMonitoringService,
    private readonly signatureService: SignatureDetectionService,
    private readonly ddosService: DdosDetectionService,
  ) {}

  // ========================
  // Overview
  // ========================

  @Get('overview')
  async getOverview(): Promise<any> {
    const [sslSummary, iocSummary, sigSummary, ddosSummary] =
      await Promise.all([
        this.sslService.getSummary(),
        this.iocService.getSummary(),
        this.signatureService.getSummary(),
        this.ddosService.getSummary(),
      ]);

    return {
      ssl: {
        averageScore: sslSummary.averageSecurityScore,
        total: sslSummary.total,
        expired: sslSummary.expired,
        expiringSoon: sslSummary.expiringSoon,
      },
      ioc: {
        totalMatches: iocSummary.totalMatches,
        active: iocSummary.active,
        matched: iocSummary.matched,
      },
      signatures: {
        total: sigSummary.total,
        last24h: sigSummary.last24h,
        criticalLastHour: sigSummary.criticalLastHour,
      },
      ddos: {
        active: ddosSummary.active,
        mitigated: ddosSummary.mitigated,
        peakBandwidthGbps: ddosSummary.peakBandwidthGbps,
      },
    };
  }

  // ========================
  // SSL/TLS Endpoints
  // ========================

  @Get('ssl/certificates')
  async getSslCertificates(
    @Query('status') status?: CertificateStatus,
    @Query('hostname') hostname?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sslService.getCertificates({
      status,
      hostname,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('ssl/certificates/:id')
  async getSslCertificateById(@Param('id') id: string) {
    return this.sslService.getCertificateById(id);
  }

  @Get('ssl/summary')
  async getSslSummary() {
    return this.sslService.getSummary();
  }

  @Post('ssl/scan')
  @HttpCode(HttpStatus.OK)
  async scanSslHost(@Body() body: { hostname: string; port?: number }) {
    return this.sslService.scanHost(body.hostname, body.port);
  }

  // ========================
  // IOC Endpoints
  // ========================

  @Get('ioc/entries')
  async getIocEntries(
    @Query('type') type?: IocType,
    @Query('severity') severity?: IocSeverity,
    @Query('status') status?: IocStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.iocService.getEntries({
      type,
      severity,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('ioc/entries/:id')
  async getIocEntryById(@Param('id') id: string) {
    return this.iocService.getEntryById(id);
  }

  @Get('ioc/summary')
  async getIocSummary() {
    return this.iocService.getSummary();
  }

  @Get('ioc/recent-matches')
  async getIocRecentMatches(@Query('limit') limit?: string) {
    return this.iocService.getRecentMatches(limit ? parseInt(limit, 10) : 20);
  }

  @Post('ioc/entries')
  async createIocEntry(
    @Body() body: { type: string; indicator: string; source: string; severity?: string; threatType?: string; description?: string },
  ) {
    return this.iocService.createEntry({
      type: body.type as any,
      indicator: body.indicator,
      source: body.source,
      severity: body.severity as any,
      threatType: body.threatType,
      description: body.description,
    });
  }

  @Post('ioc/import')
  @HttpCode(HttpStatus.OK)
  async importIocCsv(@Body() body: { csvContent: string }) {
    return this.iocService.importCsv(body.csvContent);
  }

  @Put('ioc/entries/:id/status')
  async updateIocStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.iocService.updateStatus(id, body.status as IocStatus);
  }

  // ========================
  // Signature Endpoints
  // ========================

  @Get('signatures/alerts')
  async getSignatureAlerts(
    @Query('category') category?: SignatureCategory,
    @Query('severity') severity?: SignatureSeverity,
    @Query('status') status?: SignatureAlertStatus,
    @Query('sourceIp') sourceIp?: string,
    @Query('destinationIp') destinationIp?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.signatureService.getAlerts({
      category,
      severity,
      status,
      sourceIp,
      destinationIp,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('signatures/summary')
  async getSignatureSummary() {
    return this.signatureService.getSummary();
  }

  @Post('signatures/alerts/bulk-action')
  @HttpCode(HttpStatus.OK)
  async bulkSignatureAction(
    @Body() body: { ids: string[]; action: 'acknowledge' | 'dismiss' | 'escalate'; by: string; notes?: string },
  ) {
    return this.signatureService.bulkUpdateStatus(body.ids, body.action, body.by, body.notes);
  }

  @Get('signatures/alerts/:id')
  async getSignatureAlertById(@Param('id') id: string) {
    return this.signatureService.getAlertById(id);
  }

  @Get('signatures/alerts/:id/packet')
  async getSignaturePacket(@Param('id') id: string) {
    return this.signatureService.getPacketDrilldown(id);
  }

  @Post('signatures/alerts/:id/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledgeSignatureAlert(
    @Param('id') id: string,
    @Body() body: { by: string },
  ) {
    return this.signatureService.acknowledgeAlert(id, body.by);
  }

  @Post('signatures/alerts/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismissSignatureAlert(
    @Param('id') id: string,
    @Body() body: { by: string },
  ) {
    return this.signatureService.dismissAlert(id, body.by);
  }

  @Post('signatures/alerts/:id/escalate')
  @HttpCode(HttpStatus.OK)
  async escalateSignatureAlert(
    @Param('id') id: string,
    @Body() body: { by: string; notes?: string },
  ) {
    return this.signatureService.escalateAlert(id, body.by, body.notes);
  }

  // ========================
  // DDoS Endpoints
  // ========================

  @Get('ddos/events')
  async getDdosEvents(
    @Query('status') status?: DdosStatus,
    @Query('attackType') attackType?: DdosAttackType,
    @Query('severity') severity?: DdosSeverity,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ddosService.getEvents({
      status,
      attackType,
      severity,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('ddos/events/:id')
  async getDdosEventById(@Param('id') id: string) {
    return this.ddosService.getEventById(id);
  }

  @Get('ddos/summary')
  async getDdosSummary() {
    return this.ddosService.getSummary();
  }

  @Get('ddos/active')
  async getDdosActiveAttacks() {
    return this.ddosService.getActiveAttacks();
  }

  @Get('ddos/report/:id')
  async getDdosReport(@Param('id') id: string) {
    return this.ddosService.getDetailedReport(id);
  }

  @Post('ddos/events/:id/mitigate')
  @HttpCode(HttpStatus.OK)
  async mitigateDdosEvent(
    @Param('id') id: string,
    @Body() body: { strategy: string; initiatedBy: string; notes?: string },
  ) {
    return this.ddosService.mitigateEvent(id, body);
  }

  @Post('ddos/events/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveDdosEvent(
    @Param('id') id: string,
    @Body() body: { resolvedBy: string; notes?: string },
  ) {
    return this.ddosService.resolveEvent(id, body);
  }
}
