import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  SslCertificate,
  CertificateStatus,
  TlsVersion,
} from '../../entities/ssl-certificate.entity';
import {
  IocEntry,
  IocType,
  IocSeverity,
  IocStatus,
} from '../../entities/ioc-entry.entity';
import {
  SignatureAlert,
  SignatureAlertStatus,
  SignatureCategory,
  SignatureSeverity,
  SignatureAction,
} from '../../entities/signature-alert.entity';
import {
  DdosEvent,
  DdosAttackType,
  DdosSeverity,
  DdosStatus,
} from '../../entities/ddos-event.entity';

@Injectable()
export class SecuritySimulatorService implements OnModuleInit {
  private readonly logger = new Logger(SecuritySimulatorService.name);
  private initialized = false;

  constructor(
    @InjectRepository(SslCertificate)
    private sslRepo: Repository<SslCertificate>,
    @InjectRepository(IocEntry)
    private iocRepo: Repository<IocEntry>,
    @InjectRepository(SignatureAlert)
    private sigRepo: Repository<SignatureAlert>,
    @InjectRepository(DdosEvent)
    private ddosRepo: Repository<DdosEvent>,
  ) {}

  async onModuleInit() {
    // Small delay to let DB synchronize
    setTimeout(() => this.seedInitialData(), 5000);
  }

  private async seedInitialData() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const sslCount = await this.sslRepo.count();
      if (sslCount === 0) {
        this.logger.log('Seeding SSL certificates...');
        await this.seedSslCertificates();
      }

      const iocCount = await this.iocRepo.count();
      if (iocCount === 0) {
        this.logger.log('Seeding IOC entries...');
        await this.seedIocEntries();
      }

      const sigCount = await this.sigRepo.count();
      if (sigCount === 0) {
        this.logger.log('Seeding initial signature alerts...');
        await this.generateSignatureAlerts();
      }

      const ddosCount = await this.ddosRepo.count();
      if (ddosCount === 0) {
        this.logger.log('Seeding initial DDoS events...');
        await this.seedDdosEvents();
      }

      this.logger.log('Security data seeding complete');
    } catch (error) {
      this.logger.error('Failed to seed security data', error);
    }
  }

  // ========================
  // SSL Certificate Simulation
  // ========================

  private async seedSslCertificates(): Promise<void> {
    const hosts = [
      { hostname: 'portal.canaris.io', issuer: 'DigiCert Global G2' },
      { hostname: 'api.canaris.io', issuer: 'DigiCert Global G2' },
      { hostname: 'mail.canaris.io', issuer: "Let's Encrypt Authority X3" },
      { hostname: 'vpn.canaris.io', issuer: 'Sectigo RSA Domain Validation' },
      { hostname: 'monitoring.canaris.io', issuer: "Let's Encrypt Authority X3" },
      { hostname: 'git.canaris.io', issuer: 'DigiCert SHA2 Extended Validation' },
      { hostname: 'jenkins.canaris.io', issuer: 'Self-Signed' },
      { hostname: 'legacy-app.canaris.io', issuer: 'GeoTrust RSA CA 2018' },
      { hostname: 'dev.canaris.io', issuer: 'Self-Signed' },
      { hostname: 'staging.canaris.io', issuer: "Let's Encrypt Authority X3" },
      { hostname: 'cdn.canaris.io', issuer: 'Amazon RSA 2048 M02' },
      { hostname: 'auth.canaris.io', issuer: 'DigiCert Global G2' },
      { hostname: 'payments.canaris.io', issuer: 'DigiCert SHA2 Extended Validation' },
      { hostname: 'docs.canaris.io', issuer: "Let's Encrypt Authority X3" },
      { hostname: 'status.canaris.io', issuer: "Let's Encrypt Authority X3" },
      { hostname: 'internal.canaris.io', issuer: 'Canaris Internal CA' },
      { hostname: 'backup.canaris.io', issuer: 'Sectigo RSA Domain Validation' },
      { hostname: 'db-admin.canaris.io', issuer: 'Self-Signed' },
      { hostname: 'kafka.canaris.io', issuer: 'Canaris Internal CA' },
      { hostname: 'grafana.canaris.io', issuer: "Let's Encrypt Authority X3" },
    ];

    const tlsVersions = [TlsVersion.TLS_1_3, TlsVersion.TLS_1_2, TlsVersion.TLS_1_1, TlsVersion.TLS_1_0];
    const cipherSuites = [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-SHA',
    ];

    const certs: Partial<SslCertificate>[] = hosts.map((host, idx) => {
      const isSelfSigned = host.issuer.includes('Self-Signed');
      const isInternal = host.issuer.includes('Internal');
      const now = new Date();

      // Vary expiry: some valid, some expiring, some expired
      let expiresAt: Date;
      let status: CertificateStatus;
      if (idx === 7) {
        // legacy-app: expired
        expiresAt = new Date(now.getTime() - 30 * 86400000);
        status = CertificateStatus.EXPIRED;
      } else if (idx === 2 || idx === 9) {
        // expiring soon
        expiresAt = new Date(now.getTime() + 15 * 86400000);
        status = CertificateStatus.EXPIRING_SOON;
      } else if (isSelfSigned) {
        expiresAt = new Date(now.getTime() + 365 * 86400000);
        status = CertificateStatus.SELF_SIGNED;
      } else {
        expiresAt = new Date(now.getTime() + (90 + Math.random() * 275) * 86400000);
        status = CertificateStatus.VALID;
      }

      const daysUntilExpiry = Math.round(
        (expiresAt.getTime() - now.getTime()) / 86400000,
      );

      const tlsVersion = idx < 10 ? tlsVersions[idx % 2] : tlsVersions[Math.floor(Math.random() * 2)];
      const keyLength = tlsVersion === TlsVersion.TLS_1_3 ? 4096 : idx % 3 === 0 ? 4096 : 2048;

      let securityScore = 100;
      if (status === CertificateStatus.EXPIRED) securityScore = 10;
      else if (status === CertificateStatus.SELF_SIGNED) securityScore = 40;
      else if (status === CertificateStatus.EXPIRING_SOON) securityScore = 60;
      else if (tlsVersion === TlsVersion.TLS_1_0) securityScore = 45;
      else if (tlsVersion === TlsVersion.TLS_1_1) securityScore = 55;
      else if (keyLength < 4096) securityScore = 80;

      const vulnerabilities: string[] = [];
      if (tlsVersion === TlsVersion.TLS_1_0) vulnerabilities.push('POODLE', 'BEAST');
      if (tlsVersion === TlsVersion.TLS_1_1) vulnerabilities.push('Weak cipher support');
      if (isSelfSigned) vulnerabilities.push('Self-signed certificate');
      if (keyLength < 2048) vulnerabilities.push('Weak key length');

      return {
        hostname: host.hostname,
        port: 443,
        issuer: host.issuer,
        subject: `CN=${host.hostname}`,
        serialNumber: this.randomHex(20),
        fingerprint: `SHA256:${this.randomHex(32)}`,
        status,
        tlsVersion,
        cipherSuite: cipherSuites[idx % cipherSuites.length],
        keyLength,
        isSelfSigned,
        isChainValid: !isSelfSigned && !isInternal,
        issuedAt: new Date(expiresAt.getTime() - 365 * 86400000),
        expiresAt,
        daysUntilExpiry,
        securityScore,
        vulnerabilities,
        metadata: { autoDiscovered: true },
        lastChecked: now,
      };
    });

    await this.sslRepo.save(this.sslRepo.create(certs));
  }

  @Cron('0 */5 * * * *') // every 5 minutes
  async updateSslCertificates(): Promise<void> {
    try {
      const certs = await this.sslRepo.find();
      if (certs.length === 0) return;

      const now = new Date();
      for (const cert of certs) {
        cert.daysUntilExpiry = Math.round(
          (new Date(cert.expiresAt).getTime() - now.getTime()) / 86400000,
        );
        if (cert.daysUntilExpiry <= 0 && cert.status !== CertificateStatus.EXPIRED) {
          cert.status = CertificateStatus.EXPIRED;
          cert.securityScore = 10;
        } else if (
          cert.daysUntilExpiry <= 30 &&
          cert.daysUntilExpiry > 0 &&
          cert.status === CertificateStatus.VALID
        ) {
          cert.status = CertificateStatus.EXPIRING_SOON;
          cert.securityScore = 60;
        }
        cert.lastChecked = now;
      }

      await this.sslRepo.save(certs);
    } catch (error) {
      this.logger.error('SSL update failed', error);
    }
  }

  // ========================
  // IOC Simulation
  // ========================

  private async seedIocEntries(): Promise<void> {
    const iocTypes = Object.values(IocType);
    const severities = Object.values(IocSeverity);
    const sources = [
      'AlienVault OTX', 'Abuse.ch', 'VirusTotal', 'CrowdStrike Falcon',
      'MISP Community', 'Cisco Talos', 'IBM X-Force', 'ThreatFox',
    ];
    const threatTypes = [
      'C2 Server', 'Malware Distribution', 'Phishing', 'Botnet',
      'Ransomware', 'Cryptominer', 'Data Exfiltration', 'DGA Domain',
    ];

    const entries: Partial<IocEntry>[] = [];
    for (let i = 0; i < 50; i++) {
      const type = iocTypes[i % iocTypes.length];
      let indicator: string;
      switch (type) {
        case IocType.IP_ADDRESS:
          indicator = `${this.randInt(1, 223)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
          break;
        case IocType.DOMAIN:
          indicator = `${this.randomWord()}-${this.randomWord()}.${['xyz', 'top', 'ru', 'cn', 'tk'][this.randInt(0, 4)]}`;
          break;
        case IocType.URL:
          indicator = `http://${this.randomWord()}.${['xyz', 'tk'][this.randInt(0, 1)]}/malware/${this.randomHex(8)}`;
          break;
        case IocType.FILE_HASH:
          indicator = this.randomHex(32);
          break;
        case IocType.EMAIL:
          indicator = `${this.randomWord()}@${this.randomWord()}.${['ru', 'cn', 'tk'][this.randInt(0, 2)]}`;
          break;
        default:
          indicator = this.randomHex(16);
      }

      const severity = severities[i % severities.length];
      const hasMatch = Math.random() > 0.6;
      entries.push({
        type,
        indicator,
        source: sources[i % sources.length],
        severity,
        status: hasMatch ? IocStatus.MATCHED : IocStatus.ACTIVE,
        threatType: threatTypes[i % threatTypes.length],
        description: `Threat intelligence indicator from ${sources[i % sources.length]}`,
        matchCount: hasMatch ? this.randInt(1, 25) : 0,
        lastMatchedAt: hasMatch ? new Date(Date.now() - this.randInt(0, 86400000)) : undefined,
        lastMatchedSourceIp: hasMatch ? `10.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}` : undefined,
        lastMatchedDestIp: hasMatch ? `${this.randInt(1, 223)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}` : undefined,
        metadata: { feed: sources[i % sources.length], confidence: this.randInt(60, 100) },
        expiresAt: new Date(Date.now() + this.randInt(7, 90) * 86400000),
      });
    }

    await this.iocRepo.save(this.iocRepo.create(entries));
  }

  @Cron('0 */3 * * * *') // every 3 minutes
  async simulateIocMatches(): Promise<void> {
    try {
      const activeIocs = await this.iocRepo.find({
        where: { status: IocStatus.ACTIVE },
        take: 10,
      });

      if (activeIocs.length === 0) return;

      // Randomly match 1-3 IOCs
      const matchCount = this.randInt(1, Math.min(3, activeIocs.length));
      for (let i = 0; i < matchCount; i++) {
        const ioc = activeIocs[this.randInt(0, activeIocs.length - 1)];
        ioc.status = IocStatus.MATCHED;
        ioc.matchCount += 1;
        ioc.lastMatchedAt = new Date();
        ioc.lastMatchedSourceIp = `10.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
        ioc.lastMatchedDestIp = `${this.randInt(1, 223)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
        await this.iocRepo.save(ioc);
      }
    } catch (error) {
      this.logger.error('IOC simulation failed', error);
    }
  }

  // ========================
  // Signature Alert Simulation
  // ========================

  private readonly signatureTemplates = [
    { id: 'SID-2001', name: 'ET MALWARE Win32/Emotet Activity', category: SignatureCategory.MALWARE, severity: SignatureSeverity.CRITICAL },
    { id: 'SID-2002', name: 'ET EXPLOIT Apache Log4j RCE Attempt', category: SignatureCategory.EXPLOIT, severity: SignatureSeverity.CRITICAL },
    { id: 'SID-2003', name: 'ET SCAN Nmap SYN Scan Detected', category: SignatureCategory.RECONNAISSANCE, severity: SignatureSeverity.MEDIUM },
    { id: 'SID-2004', name: 'ET POLICY DNS Query to .tk TLD', category: SignatureCategory.POLICY_VIOLATION, severity: SignatureSeverity.LOW },
    { id: 'SID-2005', name: 'ET MALWARE Cobalt Strike Beacon C2', category: SignatureCategory.MALWARE, severity: SignatureSeverity.CRITICAL },
    { id: 'SID-2006', name: 'ET EXPLOIT SMB EternalBlue Attempt', category: SignatureCategory.EXPLOIT, severity: SignatureSeverity.HIGH },
    { id: 'SID-2007', name: 'ET SCAN Masscan Activity Detected', category: SignatureCategory.RECONNAISSANCE, severity: SignatureSeverity.MEDIUM },
    { id: 'SID-2008', name: 'ET PROTOCOL HTTP Request to Non-Standard Port', category: SignatureCategory.PROTOCOL_ANOMALY, severity: SignatureSeverity.LOW },
    { id: 'SID-2009', name: 'ET SUSPICIOUS PowerShell Download Cradle', category: SignatureCategory.SUSPICIOUS, severity: SignatureSeverity.HIGH },
    { id: 'SID-2010', name: 'ET MALWARE Ransomware File Extension Change', category: SignatureCategory.MALWARE, severity: SignatureSeverity.CRITICAL },
    { id: 'SID-2011', name: 'ET EXPLOIT SQL Injection Attempt', category: SignatureCategory.EXPLOIT, severity: SignatureSeverity.HIGH },
    { id: 'SID-2012', name: 'ET POLICY Outbound SSH on Non-Standard Port', category: SignatureCategory.POLICY_VIOLATION, severity: SignatureSeverity.INFO },
    { id: 'SID-2013', name: 'ET SCAN Nikto Web Scanner Detected', category: SignatureCategory.RECONNAISSANCE, severity: SignatureSeverity.MEDIUM },
    { id: 'SID-2014', name: 'ET SUSPICIOUS DNS TXT Record Large Response', category: SignatureCategory.SUSPICIOUS, severity: SignatureSeverity.MEDIUM },
    { id: 'SID-2015', name: 'ET MALWARE TrickBot HTTP Request', category: SignatureCategory.MALWARE, severity: SignatureSeverity.HIGH },
  ];

  private async generateSignatureAlerts(): Promise<void> {
    const alerts: Partial<SignatureAlert>[] = [];
    const count = this.randInt(10, 20);

    for (let i = 0; i < count; i++) {
      const template = this.signatureTemplates[this.randInt(0, this.signatureTemplates.length - 1)];
      alerts.push(this.buildSignatureAlert(template));
    }

    await this.sigRepo.save(this.sigRepo.create(alerts));
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async simulateSignatureAlerts(): Promise<void> {
    try {
      const count = this.randInt(2, 5);
      const alerts: Partial<SignatureAlert>[] = [];

      for (let i = 0; i < count; i++) {
        const template = this.signatureTemplates[this.randInt(0, this.signatureTemplates.length - 1)];
        alerts.push(this.buildSignatureAlert(template));
      }

      await this.sigRepo.save(this.sigRepo.create(alerts));
    } catch (error) {
      this.logger.error('Signature simulation failed', error);
    }
  }

  private buildSignatureAlert(template: any): Partial<SignatureAlert> {
    const protocols = ['TCP', 'UDP', 'ICMP'];
    const actions = Object.values(SignatureAction);
    // Generate a realistic-looking packet payload in base64
    const payloadSize = this.randInt(64, 512);
    const payload = Buffer.alloc(payloadSize);
    for (let i = 0; i < payloadSize; i++) {
      payload[i] = Math.floor(Math.random() * 256);
    }
    // Embed some readable text in the payload
    const texts = ['GET /malware HTTP/1.1', 'POST /c2/beacon', 'User-Agent: Mozilla', 'Host: evil.example'];
    const text = texts[this.randInt(0, texts.length - 1)];
    payload.write(text, this.randInt(0, 20));

    return {
      signatureId: template.id,
      signatureName: template.name,
      category: template.category,
      severity: template.severity,
      action: actions[this.randInt(0, actions.length - 1)],
      sourceIp: `${this.randInt(1, 223)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`,
      sourcePort: this.randInt(1024, 65535),
      destinationIp: `10.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`,
      destinationPort: [80, 443, 8080, 8443, 445, 3389, 22][this.randInt(0, 6)],
      protocol: protocols[this.randInt(0, 2)],
      packetPayload: payload.toString('base64'),
      packetLength: payloadSize,
      description: `${template.name} detected from external source`,
      metadata: { engine: 'Suricata', rev: this.randInt(1, 10) },
      timestamp: new Date(Date.now() - this.randInt(0, 300000)),
      status: SignatureAlertStatus.OPEN,
    };
  }

  // ========================
  // DDoS Simulation
  // ========================

  private async seedDdosEvents(): Promise<void> {
    const events: Partial<DdosEvent>[] = [];
    const types = Object.values(DdosAttackType);
    const severities = Object.values(DdosSeverity);
    const targets = [
      { ip: '203.0.113.10', name: 'Edge Router 1', iface: 'GigabitEthernet0/0', customer: 'Acme Corp', asn: 'AS64512' },
      { ip: '203.0.113.20', name: 'Web Server Cluster', iface: 'TenGigE0/1', customer: 'TechStart Inc', asn: 'AS64513' },
      { ip: '198.51.100.5', name: 'DNS Server Primary', iface: 'GigabitEthernet0/2', customer: 'Global Services', asn: 'AS64514' },
    ];

    // Create 5 historical resolved events
    for (let i = 0; i < 5; i++) {
      const target = targets[i % targets.length];
      const detectedAt = new Date(Date.now() - this.randInt(1, 7) * 86400000);
      const duration = this.randInt(300, 3600);
      const mitigatedAt = new Date(detectedAt.getTime() + this.randInt(300, 900) * 1000);
      const resolvedAt = new Date(detectedAt.getTime() + duration * 1000);

      events.push({
        attackType: types[i % types.length],
        severity: severities[i % severities.length],
        status: DdosStatus.RESOLVED,
        targetIp: target.ip,
        targetPort: [80, 443, 53][i % 3],
        sourceIps: this.generateSourceIps(this.randInt(10, 100)),
        targetAssetName: target.name,
        routerInterface: target.iface,
        customerName: target.customer,
        asn: target.asn,
        peakBandwidthGbps: parseFloat((Math.random() * 50 + 1).toFixed(2)),
        peakPps: this.randInt(100000, 50000000),
        totalPackets: this.randInt(1000000, 500000000),
        totalBytes: this.randInt(1000000000, 50000000000),
        durationSeconds: duration,
        attackVectors: this.pickRandom(['SYN Flood', 'UDP Amplification', 'DNS Reflection', 'HTTP Flood', 'ICMP Flood', 'NTP Amplification'], this.randInt(1, 3)),
        description: `${types[i % types.length]} DDoS attack targeting ${target.name}`,
        metadata: { mitigationMethod: 'BGP Blackhole + Rate Limiting' },
        detectedAt,
        mitigatedAt,
        resolvedAt,
      });
    }

    await this.ddosRepo.save(this.ddosRepo.create(events));
  }

  @Cron('0 */2 * * * *') // every 2 minutes
  async simulateDdosEvents(): Promise<void> {
    try {
      // 20% chance of new event
      if (Math.random() > 0.2) {
        // Auto-mitigate active events older than 5-15 min
        await this.autoMitigateDdos();
        // Auto-resolve mitigated events older than 30 min
        await this.autoResolveDdos();
        return;
      }

      const types = Object.values(DdosAttackType);
      const severities = Object.values(DdosSeverity);
      const targets = [
        { ip: '203.0.113.10', name: 'Edge Router 1', iface: 'GigabitEthernet0/0', customer: 'Acme Corp', asn: 'AS64512' },
        { ip: '203.0.113.20', name: 'Web Server Cluster', iface: 'TenGigE0/1', customer: 'TechStart Inc', asn: 'AS64513' },
        { ip: '198.51.100.5', name: 'DNS Server Primary', iface: 'GigabitEthernet0/2', customer: 'Global Services', asn: 'AS64514' },
        { ip: '198.51.100.15', name: 'Mail Server', iface: 'GigabitEthernet0/3', customer: 'SecureComm Ltd', asn: 'AS64515' },
      ];

      const target = targets[this.randInt(0, targets.length - 1)];
      const attackType = types[this.randInt(0, types.length - 1)];

      const event = this.ddosRepo.create({
        attackType,
        severity: severities[this.randInt(0, severities.length - 1)],
        status: DdosStatus.ACTIVE,
        targetIp: target.ip,
        targetPort: [80, 443, 53, 25][this.randInt(0, 3)],
        sourceIps: this.generateSourceIps(this.randInt(20, 200)),
        targetAssetName: target.name,
        routerInterface: target.iface,
        customerName: target.customer,
        asn: target.asn,
        peakBandwidthGbps: parseFloat((Math.random() * 100 + 0.5).toFixed(2)),
        peakPps: this.randInt(500000, 100000000),
        totalPackets: this.randInt(5000000, 1000000000),
        totalBytes: this.randInt(5000000000, 100000000000),
        durationSeconds: 0,
        attackVectors: this.pickRandom(['SYN Flood', 'UDP Amplification', 'DNS Reflection', 'HTTP Flood', 'ICMP Flood', 'NTP Amplification', 'Memcached Amplification'], this.randInt(1, 3)),
        description: `Active ${attackType} attack targeting ${target.name} (${target.ip})`,
        metadata: { autoDetected: true, detectionEngine: 'Flow Analyzer' },
        detectedAt: new Date(),
      });

      await this.ddosRepo.save(event);
      this.logger.warn(`New DDoS event: ${attackType} attack on ${target.ip}`);
    } catch (error) {
      this.logger.error('DDoS simulation failed', error);
    }
  }

  private async autoMitigateDdos(): Promise<void> {
    const threshold = new Date(Date.now() - this.randInt(5, 15) * 60000);
    const activeEvents = await this.ddosRepo.find({
      where: {
        status: DdosStatus.ACTIVE,
        detectedAt: LessThan(threshold),
      },
    });

    for (const event of activeEvents) {
      event.status = DdosStatus.MITIGATED;
      event.mitigatedAt = new Date();
      event.durationSeconds = Math.round(
        (Date.now() - new Date(event.detectedAt).getTime()) / 1000,
      );
      await this.ddosRepo.save(event);
      this.logger.log(`DDoS event ${event.id} mitigated`);
    }
  }

  private async autoResolveDdos(): Promise<void> {
    const threshold = new Date(Date.now() - 30 * 60000);
    const mitigatedEvents = await this.ddosRepo.find({
      where: {
        status: DdosStatus.MITIGATED,
        mitigatedAt: LessThan(threshold),
      },
    });

    for (const event of mitigatedEvents) {
      event.status = DdosStatus.RESOLVED;
      event.resolvedAt = new Date();
      event.durationSeconds = Math.round(
        (Date.now() - new Date(event.detectedAt).getTime()) / 1000,
      );
      await this.ddosRepo.save(event);
      this.logger.log(`DDoS event ${event.id} resolved`);
    }
  }

  // ========================
  // Cleanup
  // ========================

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    try {
      // Prune signature alerts older than 7 days
      const sigCutoff = new Date(Date.now() - 7 * 86400000);
      const sigResult = await this.sigRepo.delete({
        timestamp: LessThan(sigCutoff),
      });
      if (sigResult.affected && sigResult.affected > 0) {
        this.logger.log(`Cleaned up ${sigResult.affected} old signature alerts`);
      }

      // Prune resolved DDoS events older than 30 days
      const ddosCutoff = new Date(Date.now() - 30 * 86400000);
      const ddosResult = await this.ddosRepo.delete({
        status: DdosStatus.RESOLVED,
        resolvedAt: LessThan(ddosCutoff),
      });
      if (ddosResult.affected && ddosResult.affected > 0) {
        this.logger.log(`Cleaned up ${ddosResult.affected} old DDoS events`);
      }

      // Expire old IOCs
      const iocCutoff = new Date();
      const expiredIocs = await this.iocRepo.find({
        where: {
          status: IocStatus.ACTIVE,
          expiresAt: LessThan(iocCutoff),
        },
      });
      for (const ioc of expiredIocs) {
        ioc.status = IocStatus.EXPIRED;
        await this.iocRepo.save(ioc);
      }
    } catch (error) {
      this.logger.error('Cleanup failed', error);
    }
  }

  // ========================
  // Helpers
  // ========================

  private randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomHex(bytes: number): string {
    return Array.from({ length: bytes }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('');
  }

  private randomWord(): string {
    const words = ['dark', 'storm', 'cyber', 'ghost', 'shadow', 'rapid', 'black', 'iron', 'nova', 'pulse', 'venom', 'apex', 'flux', 'zero'];
    return words[this.randInt(0, words.length - 1)];
  }

  private generateSourceIps(count: number): string[] {
    return Array.from({ length: count }, () =>
      `${this.randInt(1, 223)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`,
    );
  }

  private pickRandom<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
