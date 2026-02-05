/**
 * Database Seed Script
 * Populates all tables with realistic test data.
 * Usage: npm run seed
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ─── DataSource ───────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USER || 'ems_admin',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'ems_platform',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}
function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 86400_000);
}
function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86400_000);
}
function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLicenseKey(signingSecret: string): string {
  const typeCode = 'SUB';
  const tierCode = 'EMS';
  const dateCode = daysFromNow(365).toISOString().slice(0, 10).replace(/-/g, '');
  const payload = JSON.stringify({ t: typeCode, r: tierCode, d: 1000, e: dateCode, n: crypto.randomBytes(4).toString('hex') });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret).update(encoded).digest('base64url').substring(0, 16);
  return `CANARIS-${typeCode}-${tierCode}-${dateCode}-${encoded}-${signature}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Connecting to database...');
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();

  try {
    // ── Truncate ────────────────────────────────────────────────────────────
    console.log('🗑️  Truncating tables...');
    await qr.query(`
      TRUNCATE TABLE
        license_audit_logs, licenses,
        ddos_events, signature_alerts, ioc_entries, ssl_certificates,
        alerts, events,
        traffic_flows, device_metrics_history, metrics,
        device_health, device_connections, device_interfaces,
        threshold_rules,
        dashboard_configurations, report_schedules, report_history, report_definitions,
        assets, customers, users, roles
      CASCADE
    `);

    // ── 1. Roles ────────────────────────────────────────────────────────────
    console.log('👥 Seeding roles...');
    await qr.query(`
      INSERT INTO roles (id, name, display_name, description, is_system_role, is_active) VALUES
      (1, 'super_admin', 'Super Admin', 'Full system access', true, true),
      (2, 'admin', 'Admin', 'Administrative access', true, true),
      (3, 'operator', 'Operator', 'Operations access', true, true),
      (4, 'viewer', 'Viewer', 'Read-only access', true, true)
    `);
    await qr.query(`SELECT setval('roles_id_seq', 4)`);

    // ── 2. Users ────────────────────────────────────────────────────────────
    console.log('👤 Seeding users...');
    const passwordHash = await bcrypt.hash('Admin@123456', 10);
    await qr.query(`
      INSERT INTO users (id, username, email, password, role_id, force_password_change) VALUES
      (1, 'admin',          'admin@canaris.io',    $1, 1, false),
      (2, 'john.operator',  'john@canaris.io',     $1, 3, false),
      (3, 'sarah.admin',    'sarah@canaris.io',    $1, 2, false),
      (4, 'mike.viewer',    'mike@canaris.io',     $1, 4, false),
      (5, 'system',         'system@canaris.io',   $1, 1, false)
    `, [passwordHash]);
    await qr.query(`SELECT setval('users_id_seq', 5)`);

    // ── 3. Customers ────────────────────────────────────────────────────────
    console.log('🏢 Seeding customers...');
    await qr.query(`
      INSERT INTO customers (id, customer_code, customer_name, customer_type, parent_customer_id, contact_person, email, phone, city, state, country, industry, is_active) VALUES
      (1, 'CAN-HQ',   'Canaris Networks',         'Headquarters', NULL, 'Rajesh Kumar',  'rajesh@canaris.io',  '+91-22-12345678', 'Mumbai',    'Maharashtra', 'India', 'Technology', true),
      (2, 'CAN-MUM',  'Canaris Mumbai DC',         'Branch',       1,   'Priya Sharma',  'priya@canaris.io',   '+91-22-87654321', 'Mumbai',    'Maharashtra', 'India', 'Technology', true),
      (3, 'CAN-DEL',  'Canaris Delhi Office',      'Branch',       1,   'Amit Singh',    'amit@canaris.io',    '+91-11-12345678', 'New Delhi', 'Delhi',       'India', 'Technology', true),
      (4, 'CAN-BLR',  'Canaris Bangalore Lab',     'Branch',       1,   'Deepa Rao',     'deepa@canaris.io',   '+91-80-12345678', 'Bangalore', 'Karnataka',   'India', 'Technology', true),
      (5, 'CAN-CHN',  'Canaris Chennai Branch',    'Branch',       1,   'Karthik Subram', 'karthik@canaris.io', '+91-44-12345678', 'Chennai',   'Tamil Nadu',  'India', 'Technology', true)
    `);
    await qr.query(`SELECT setval('customers_id_seq', 5)`);

    // ── 4. Assets ───────────────────────────────────────────────────────────
    console.log('🖥️  Seeding assets (20)...');
    const assetIds: string[] = [];
    const assets = [
      // Routers (4)
      { name: 'core-rtr-01',    type: 'router',        ip: '10.0.0.1',   location: 'Mumbai DC - Rack A1',    vendor: 'Cisco',    model: 'ISR 4451', tier: 1 },
      { name: 'core-rtr-02',    type: 'router',        ip: '10.0.0.2',   location: 'Mumbai DC - Rack A2',    vendor: 'Cisco',    model: 'ISR 4451', tier: 1 },
      { name: 'edge-rtr-del',   type: 'router',        ip: '10.1.0.1',   location: 'Delhi Office',           vendor: 'Juniper',  model: 'MX204',    tier: 2 },
      { name: 'edge-rtr-blr',   type: 'router',        ip: '10.2.0.1',   location: 'Bangalore Lab',          vendor: 'Juniper',  model: 'MX204',    tier: 2 },
      // Switches (4)
      { name: 'dist-sw-01',     type: 'switch',        ip: '10.0.1.1',   location: 'Mumbai DC - Rack B1',    vendor: 'Cisco',    model: 'C9300',    tier: 1 },
      { name: 'dist-sw-02',     type: 'switch',        ip: '10.0.1.2',   location: 'Mumbai DC - Rack B2',    vendor: 'Cisco',    model: 'C9300',    tier: 2 },
      { name: 'access-sw-del',  type: 'switch',        ip: '10.1.1.1',   location: 'Delhi Office',           vendor: 'Arista',   model: 'DCS-7050', tier: 2 },
      { name: 'access-sw-blr',  type: 'switch',        ip: '10.2.1.1',   location: 'Bangalore Lab',          vendor: 'Arista',   model: 'DCS-7050', tier: 3 },
      // Firewalls (2)
      { name: 'fw-primary',     type: 'firewall',      ip: '10.0.0.10',  location: 'Mumbai DC - Rack A1',    vendor: 'Palo Alto', model: 'PA-5260', tier: 1 },
      { name: 'fw-secondary',   type: 'firewall',      ip: '10.0.0.11',  location: 'Mumbai DC - Rack A2',    vendor: 'Palo Alto', model: 'PA-5260', tier: 1 },
      // Servers (4)
      { name: 'app-srv-01',     type: 'server',        ip: '10.0.10.1',  location: 'Mumbai DC - Rack C1',    vendor: 'Dell',     model: 'R740',     tier: 1 },
      { name: 'app-srv-02',     type: 'server',        ip: '10.0.10.2',  location: 'Mumbai DC - Rack C2',    vendor: 'Dell',     model: 'R740',     tier: 2 },
      { name: 'db-srv-01',      type: 'server',        ip: '10.0.10.10', location: 'Mumbai DC - Rack D1',    vendor: 'Dell',     model: 'R840',     tier: 1 },
      { name: 'mon-srv-01',     type: 'server',        ip: '10.0.10.20', location: 'Mumbai DC - Rack D2',    vendor: 'HP',       model: 'DL380',    tier: 2 },
      // Load Balancer (1)
      { name: 'lb-01',          type: 'load_balancer',  ip: '10.0.0.20',  location: 'Mumbai DC - Rack A1',    vendor: 'F5',       model: 'BIG-IP i5800', tier: 1 },
      // VMs (3)
      { name: 'web-vm-01',      type: 'vm',            ip: '10.0.20.1',  location: 'Mumbai DC - VMware',     vendor: 'VMware',   model: 'vSphere',  tier: 2 },
      { name: 'web-vm-02',      type: 'vm',            ip: '10.0.20.2',  location: 'Mumbai DC - VMware',     vendor: 'VMware',   model: 'vSphere',  tier: 3 },
      { name: 'ci-vm-01',       type: 'vm',            ip: '10.0.20.10', location: 'Bangalore Lab - VMware', vendor: 'VMware',   model: 'vSphere',  tier: 3 },
      // EC2 (2)
      { name: 'aws-web-01',     type: 'ec2',           ip: '172.31.1.10', location: 'AWS ap-south-1',        vendor: 'AWS',      model: 't3.large', tier: 2 },
      { name: 'aws-api-01',     type: 'ec2',           ip: '172.31.1.20', location: 'AWS ap-south-1',        vendor: 'AWS',      model: 'c5.xlarge', tier: 1 },
    ];
    const statuses = ['online', 'online', 'online', 'online', 'warning', 'online', 'online', 'online',
      'online', 'online', 'online', 'online', 'online', 'warning', 'online', 'online',
      'online', 'offline', 'online', 'online'];

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const id = uuidv4();
      assetIds.push(id);
      await qr.query(`
        INSERT INTO assets (id, name, type, ip, location, vendor, model, tier, owner, department, status, "monitoringEnabled", metadata, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOC Team', 'Infrastructure', $9, true, '{}', '')
      `, [id, a.name, a.type, a.ip, a.location, a.vendor, a.model, a.tier, statuses[i]]);
    }

    // ── 5. Device Interfaces ────────────────────────────────────────────────
    console.log('🔌 Seeding device interfaces (40)...');
    const interfaceIds: number[] = [];
    let ifaceId = 1;
    for (let i = 0; i < assetIds.length; i++) {
      const ifCount = i < 10 ? 3 : 1; // network devices get 3, rest get 1
      for (let j = 0; j < ifCount; j++) {
        const isUp = Math.random() > 0.15;
        await qr.query(`
          INSERT INTO device_interfaces (id, asset_id, interface_name, interface_alias, interface_index, interface_type, speed_mbps, mtu, admin_status, operational_status, is_monitored)
          VALUES ($1, $2, $3, $4, $5, 'ethernet', $6, 1500, 'up', $7, true)
        `, [ifaceId, assetIds[i], `GigE0/${j}`, `Port ${j}`, j, j === 0 ? 10000 : 1000, isUp ? 'up' : 'down']);
        interfaceIds.push(ifaceId);
        ifaceId++;
      }
    }
    await qr.query(`SELECT setval('device_interfaces_id_seq', ${ifaceId - 1})`);

    // ── 6. Device Connections ───────────────────────────────────────────────
    console.log('🔗 Seeding device connections (15)...');
    const connections = [
      [0, 4], [0, 5], [1, 4], [1, 5],     // core routers → dist switches
      [2, 6], [3, 7],                       // edge routers → access switches
      [4, 10], [4, 12], [5, 11], [5, 13],  // dist switches → servers
      [0, 8], [1, 9],                       // core routers → firewalls
      [8, 14],                               // firewall → load balancer
      [14, 10], [14, 11],                   // LB → app servers
    ];
    for (let i = 0; i < connections.length; i++) {
      const [s, d] = connections[i];
      await qr.query(`
        INSERT INTO device_connections (id, source_asset_id, destination_asset_id, connection_type, link_speed_mbps, link_status, protocol, bandwidth_utilization, latency, packet_loss, is_active)
        VALUES ($1, $2, $3, 'physical', $4, 'up', 'LLDP', $5, $6, $7, true)
      `, [i + 1, assetIds[s], assetIds[d], s < 4 ? 10000 : 1000, randomBetween(10, 75), Math.round(randomBetween(1, 15)), randomBetween(0, 0.5)]);
    }
    await qr.query(`SELECT setval('device_connections_id_seq', ${connections.length})`);

    // ── 7. Device Health ────────────────────────────────────────────────────
    console.log('💊 Seeding device health (20)...');
    for (let i = 0; i < assetIds.length; i++) {
      const score = statuses[i] === 'offline' ? 0 : statuses[i] === 'warning' ? randomBetween(45, 65) : randomBetween(70, 98);
      const status = statuses[i] === 'offline' ? 'offline' : score > 80 ? 'online' : score > 60 ? 'warning' : 'critical';
      await qr.query(`
        INSERT INTO device_health (id, asset_id, status, health_score, is_critical, last_seen, response_time_ms,
          cpu_utilization, memory_utilization, disk_utilization, bandwidth_in_mbps, bandwidth_out_mbps,
          packet_loss_percent, latency_ms, total_interfaces, interfaces_up, interfaces_down,
          active_alerts_count, critical_alerts_count, warning_alerts_count,
          uptime_percent_24h, uptime_percent_7d, uptime_percent_30d, sla_compliance, sla_target_percent, last_health_check)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12, $13, 2, $14, $15, $16, $17, $18, $19, $20, $21, $22, 99.9, NOW())
      `, [
        i + 1, assetIds[i], status, score, score < 50,
        Math.round(randomBetween(1, 50)),
        randomBetween(15, 85), randomBetween(30, 80), randomBetween(20, 70),
        randomBetween(50, 500), randomBetween(30, 300),
        randomBetween(0, 2), randomBetween(1, 20),
        Math.random() > 0.15 ? 2 : 1, Math.random() > 0.85 ? 1 : 0,
        Math.round(randomBetween(0, 3)), Math.round(randomBetween(0, 1)), Math.round(randomBetween(0, 2)),
        randomBetween(95, 100), randomBetween(96, 100), randomBetween(97, 100),
        score > 50,
      ]);
    }
    await qr.query(`SELECT setval('device_health_id_seq', ${assetIds.length})`);

    // ── 8. Threshold Rules ──────────────────────────────────────────────────
    console.log('⚡ Seeding threshold rules (6)...');
    const rules = [
      { name: 'CPU Warning',   kpi: 'cpu_usage',       warn: 80,  crit: null, op: '>', sev: 'warning' },
      { name: 'CPU Critical',  kpi: 'cpu_usage',       warn: null, crit: 95,  op: '>', sev: 'critical' },
      { name: 'Memory High',   kpi: 'memory_usage',    warn: 85,  crit: 95,  op: '>', sev: 'warning' },
      { name: 'Bandwidth Sat', kpi: 'bandwidth_util',  warn: 80,  crit: 95,  op: '>', sev: 'warning' },
      { name: 'Latency High',  kpi: 'latency_ms',      warn: 50,  crit: 100, op: '>', sev: 'warning' },
      { name: 'Packet Loss',   kpi: 'packet_loss',     warn: 1,   crit: 5,   op: '>', sev: 'critical' },
    ];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      await qr.query(`
        INSERT INTO threshold_rules (id, rule_name, kpi_code, warning_threshold, critical_threshold, operator, duration_seconds, consecutive_breaches, severity, alert_enabled, notification_enabled, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, 300, 3, $7, true, true, true, 1)
      `, [i + 1, r.name, r.kpi, r.warn, r.crit, r.op, r.sev]);
    }
    await qr.query(`SELECT setval('threshold_rules_id_seq', 6)`);

    // ── 9. Metrics (100) ────────────────────────────────────────────────────
    console.log('📊 Seeding metrics (100)...');
    const metricNames = ['cpu_usage', 'memory_usage', 'bandwidth_in', 'bandwidth_out', 'latency'];
    const metricUnits = ['percent', 'percent', 'mbps', 'mbps', 'ms'];
    for (let i = 0; i < 100; i++) {
      const mi = i % metricNames.length;
      const ai = i % assetIds.length;
      const val = mi < 2 ? randomBetween(15, 90) : mi < 4 ? randomBetween(50, 800) : randomBetween(1, 50);
      await qr.query(`
        INSERT INTO metrics (id, "assetId", "metricName", value, unit, source, timestamp)
        VALUES ($1, $2, $3, $4, $5, 'nms', $6)
      `, [uuidv4(), assetIds[ai], metricNames[mi], val, metricUnits[mi], hoursAgo(Math.random() * 24)]);
    }

    // ── 10. Device Metrics History (100) ────────────────────────────────────
    console.log('📈 Seeding device metrics history (100)...');
    const histTypes = ['cpu', 'memory', 'bandwidth_in', 'bandwidth_out', 'latency'];
    const histUnits = ['percent', 'percent', 'mbps', 'mbps', 'ms'];
    for (let i = 0; i < 100; i++) {
      const mi = i % histTypes.length;
      const ai = i % assetIds.length;
      const val = mi < 2 ? randomBetween(15, 90) : mi < 4 ? randomBetween(50, 800) : randomBetween(1, 50);
      await qr.query(`
        INSERT INTO device_metrics_history (asset_id, metric_type, value, unit, timestamp, aggregation_type, collection_interval)
        VALUES ($1, $2, $3, $4, $5, 'instant', 300)
      `, [assetIds[ai], histTypes[mi], val, histUnits[mi], hoursAgo(Math.random() * 24)]);
    }

    // ── 11. Traffic Flows (50) ──────────────────────────────────────────────
    console.log('🌐 Seeding traffic flows (50)...');
    for (let i = 0; i < 50; i++) {
      const ai = i % assetIds.length;
      const srcIp = `10.0.${Math.floor(Math.random() * 30)}.${Math.floor(Math.random() * 254) + 1}`;
      const dstIp = `10.0.${Math.floor(Math.random() * 30)}.${Math.floor(Math.random() * 254) + 1}`;
      await qr.query(`
        INSERT INTO traffic_flows (asset_id, source_ip, destination_ip, source_port, destination_port, protocol, bytes_in, bytes_out, packets_in, packets_out, flow_duration, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        assetIds[ai], srcIp, dstIp,
        Math.floor(Math.random() * 60000) + 1024, pick([80, 443, 8080, 3306, 5432, 22, 53]),
        pick(['TCP', 'UDP', 'TCP', 'TCP']),
        Math.floor(Math.random() * 10_000_000), Math.floor(Math.random() * 5_000_000),
        Math.floor(Math.random() * 50000), Math.floor(Math.random() * 25000),
        Math.floor(Math.random() * 3600),
        hoursAgo(Math.random() * 24),
      ]);
    }

    // ── 12. Events (15) ─────────────────────────────────────────────────────
    console.log('⚠️  Seeding events (15)...');
    const eventIds: string[] = [];
    const eventsData = [
      { sev: 'critical', src: 'nms', cat: 'availability',  title: 'Device Unreachable',           msg: 'Device ci-vm-01 is not responding to ICMP' },
      { sev: 'critical', src: 'nms', cat: 'performance',   title: 'CPU Critical Threshold',       msg: 'CPU utilization at 97% on core-rtr-01' },
      { sev: 'critical', src: 'siem', cat: 'security',     title: 'Brute Force Detected',         msg: 'Multiple failed SSH attempts from 203.0.113.50' },
      { sev: 'critical', src: 'nms', cat: 'availability',  title: 'Interface Down',               msg: 'GigE0/1 went down on dist-sw-01' },
      { sev: 'critical', src: 'apm', cat: 'performance',   title: 'API Response Time Critical',   msg: 'API p99 latency exceeds 5000ms' },
      { sev: 'warning',  src: 'nms', cat: 'performance',   title: 'Memory Utilization High',      msg: 'Memory at 87% on app-srv-01' },
      { sev: 'warning',  src: 'nms', cat: 'performance',   title: 'Bandwidth Saturation',         msg: 'Uplink utilization at 82% on dist-sw-02' },
      { sev: 'warning',  src: 'cloud', cat: 'performance', title: 'EC2 CPU Spike',                msg: 'aws-web-01 CPU at 78% for 10 minutes' },
      { sev: 'warning',  src: 'nms', cat: 'availability',  title: 'Packet Loss Detected',         msg: '2.3% packet loss on WAN link to Delhi' },
      { sev: 'warning',  src: 'server', cat: 'capacity',   title: 'Disk Space Warning',           msg: 'Disk at 85% on db-srv-01' },
      { sev: 'info',     src: 'nms', cat: 'configuration', title: 'Config Change Detected',       msg: 'Running config changed on core-rtr-02' },
      { sev: 'info',     src: 'nms', cat: 'availability',  title: 'Device Back Online',           msg: 'ci-vm-01 is responding again' },
      { sev: 'info',     src: 'itsm', cat: 'maintenance',  title: 'Maintenance Window Started',   msg: 'Scheduled maintenance on Bangalore Lab' },
      { sev: 'info',     src: 'nms', cat: 'performance',   title: 'Threshold Cleared',            msg: 'CPU utilization back to normal on core-rtr-01' },
      { sev: 'info',     src: 'cloud', cat: 'scaling',     title: 'Auto-Scaling Event',           msg: 'AWS ASG scaled from 2 to 3 instances' },
    ];
    for (let i = 0; i < eventsData.length; i++) {
      const e = eventsData[i];
      const id = uuidv4();
      eventIds.push(id);
      const ts = hoursAgo(Math.random() * 24);
      await qr.query(`
        INSERT INTO events (id, fingerprint, source, "assetId", severity, category, title, message, metadata, timestamp, "firstOccurrence", "lastOccurrence", "occurrenceCount")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', $9, $9, $9, $10)
      `, [id, crypto.randomBytes(16).toString('hex'), e.src, assetIds[i % assetIds.length], e.sev, e.cat, e.title, e.msg, ts, Math.floor(Math.random() * 5) + 1]);
    }

    // ── 13. Alerts (8) ──────────────────────────────────────────────────────
    console.log('🚨 Seeding alerts (8)...');
    const alertStatuses = ['open', 'open', 'open', 'acknowledged', 'acknowledged', 'resolved', 'resolved', 'closed'];
    for (let i = 0; i < 8; i++) {
      const st = alertStatuses[i];
      const now = new Date();
      await qr.query(`
        INSERT INTO alerts (id, "eventId", status, owner, team, "rootCauseAssetId", "businessImpactScore",
          "slaDeadline", "slaBreached", "createdAt", "acknowledgedAt", "resolvedAt", "closedAt", "resolutionNotes", "resolutionCategory")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        uuidv4(), eventIds[i], st,
        st !== 'open' ? 'john.operator' : null,
        pick(['NOC', 'Security', 'Infrastructure']),
        assetIds[i % assetIds.length],
        Math.round(randomBetween(20, 95)),
        new Date(now.getTime() + 4 * 3600_000),
        i === 0,
        hoursAgo(randomBetween(1, 20)),
        st !== 'open' ? hoursAgo(randomBetween(0.5, 10)) : null,
        ['resolved', 'closed'].includes(st) ? hoursAgo(randomBetween(0.1, 5)) : null,
        st === 'closed' ? hoursAgo(randomBetween(0, 1)) : null,
        ['resolved', 'closed'].includes(st) ? 'Issue resolved after investigation' : null,
        ['resolved', 'closed'].includes(st) ? 'root_cause_fixed' : null,
      ]);
    }

    // ── 14. SSL Certificates (8) ────────────────────────────────────────────
    console.log('🔒 Seeding SSL certificates (8)...');
    const certs = [
      { host: 'api.canaris.io',       status: 'valid',         exp: daysFromNow(200),  score: 95, tls: 'TLS 1.3' },
      { host: 'portal.canaris.io',    status: 'valid',         exp: daysFromNow(150),  score: 90, tls: 'TLS 1.3' },
      { host: 'vpn.canaris.io',       status: 'valid',         exp: daysFromNow(300),  score: 85, tls: 'TLS 1.2' },
      { host: 'mail.canaris.io',      status: 'valid',         exp: daysFromNow(100),  score: 88, tls: 'TLS 1.2' },
      { host: 'legacy.canaris.io',    status: 'expiring_soon', exp: daysFromNow(15),   score: 70, tls: 'TLS 1.2' },
      { host: 'dev.canaris.io',       status: 'expiring_soon', exp: daysFromNow(7),    score: 65, tls: 'TLS 1.2' },
      { host: 'old-api.canaris.io',   status: 'expired',       exp: daysAgo(10),       score: 20, tls: 'TLS 1.1' },
      { host: 'staging.canaris.io',   status: 'expired',       exp: daysAgo(30),       score: 10, tls: 'TLS 1.0' },
    ];
    for (const c of certs) {
      const issued = new Date(c.exp.getTime() - 365 * 86400_000);
      const daysUntil = Math.round((c.exp.getTime() - Date.now()) / 86400_000);
      await qr.query(`
        INSERT INTO ssl_certificates (id, hostname, port, issuer, subject, serial_number, fingerprint, status, tls_version, key_length, is_self_signed, is_chain_valid, issued_at, expires_at, days_until_expiry, security_score, last_checked)
        VALUES ($1, $2, 443, 'DigiCert Global Root G2', $3, $4, $5, $6, $7, 2048, false, true, $8, $9, $10, $11, NOW())
      `, [uuidv4(), c.host, `CN=${c.host}`, crypto.randomBytes(8).toString('hex'), crypto.randomBytes(16).toString('hex'), c.status, c.tls, issued, c.exp, daysUntil, c.score]);
    }

    // ── 15. IOC Entries (10) ────────────────────────────────────────────────
    console.log('🔍 Seeding IOC entries (10)...');
    const iocs = [
      { type: 'ip_address', indicator: '203.0.113.50',  sev: 'critical', threat: 'C2 Server',         src: 'ThreatIntel Feed' },
      { type: 'ip_address', indicator: '198.51.100.23', sev: 'high',     threat: 'Scanning Host',      src: 'Internal SIEM' },
      { type: 'ip_address', indicator: '192.0.2.100',   sev: 'medium',   threat: 'Suspicious Origin',  src: 'Abuse IPDB' },
      { type: 'ip_address', indicator: '198.51.100.99', sev: 'low',      threat: 'Tor Exit Node',      src: 'ThreatIntel Feed' },
      { type: 'domain',     indicator: 'malware-c2.evil.com',   sev: 'critical', threat: 'Malware C2',        src: 'VirusTotal' },
      { type: 'domain',     indicator: 'phishing.example.net',  sev: 'high',     threat: 'Phishing Domain',   src: 'PhishTank' },
      { type: 'domain',     indicator: 'suspicious-cdn.xyz',    sev: 'medium',   threat: 'Suspicious CDN',    src: 'Internal Analysis' },
      { type: 'file_hash',  indicator: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', sev: 'critical', threat: 'Ransomware', src: 'Malware Sandbox' },
      { type: 'file_hash',  indicator: 'deadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcdef', sev: 'high',     threat: 'Trojan',     src: 'VirusTotal' },
      { type: 'file_hash',  indicator: '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff', sev: 'medium',   threat: 'PUP',        src: 'Internal Scan' },
    ];
    for (const ioc of iocs) {
      await qr.query(`
        INSERT INTO ioc_entries (id, type, indicator, source, severity, status, threat_type, description, match_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [uuidv4(), ioc.type, ioc.indicator, ioc.src, ioc.sev, ioc.sev === 'critical' ? 'matched' : 'active', ioc.threat, `${ioc.threat} indicator from ${ioc.src}`, Math.floor(Math.random() * 50)]);
    }

    // ── 16. Signature Alerts (10) ───────────────────────────────────────────
    console.log('🛡️  Seeding signature alerts (10)...');
    const sigAlerts = [
      { sigId: 'SID-2001', name: 'ET MALWARE Win32/Emotet',           cat: 'malware',         sev: 'critical', srcIp: '10.0.10.1', dstIp: '203.0.113.50', proto: 'TCP', dPort: 443 },
      { sigId: 'SID-2002', name: 'ET EXPLOIT Apache Log4j RCE',       cat: 'exploit',         sev: 'critical', srcIp: '198.51.100.23', dstIp: '10.0.10.1', proto: 'TCP', dPort: 8080 },
      { sigId: 'SID-2003', name: 'ET SCAN Nmap SYN Scan',             cat: 'reconnaissance',  sev: 'high',     srcIp: '192.0.2.100', dstIp: '10.0.0.1', proto: 'TCP', dPort: 22 },
      { sigId: 'SID-2004', name: 'ET POLICY SSH Brute Force',         cat: 'policy_violation', sev: 'high',    srcIp: '203.0.113.50', dstIp: '10.0.10.2', proto: 'TCP', dPort: 22 },
      { sigId: 'SID-2005', name: 'ET MALWARE Cobalt Strike Beacon',   cat: 'malware',         sev: 'critical', srcIp: '10.0.20.1', dstIp: '198.51.100.99', proto: 'TCP', dPort: 443 },
      { sigId: 'SID-2006', name: 'ET EXPLOIT SMB EternalBlue',        cat: 'exploit',         sev: 'high',     srcIp: '198.51.100.23', dstIp: '10.0.10.10', proto: 'TCP', dPort: 445 },
      { sigId: 'SID-2007', name: 'ET SCAN Port Sweep Detected',       cat: 'reconnaissance',  sev: 'medium',   srcIp: '192.0.2.100', dstIp: '10.0.0.0', proto: 'TCP', dPort: 0 },
      { sigId: 'SID-2008', name: 'ET POLICY DNS Zone Transfer',       cat: 'policy_violation', sev: 'medium',  srcIp: '10.1.0.1', dstIp: '10.0.10.20', proto: 'TCP', dPort: 53 },
      { sigId: 'SID-2009', name: 'ET SUSPICIOUS TLS Cert Self-Signed', cat: 'suspicious',     sev: 'low',      srcIp: '10.0.20.10', dstIp: '172.31.1.10', proto: 'TCP', dPort: 443 },
      { sigId: 'SID-2010', name: 'ET PROTOCOL DNS Unusual Query',     cat: 'protocol_anomaly', sev: 'info',    srcIp: '10.0.20.2', dstIp: '10.0.10.20', proto: 'UDP', dPort: 53 },
    ];
    const sigStatuses = ['open', 'open', 'acknowledged', 'acknowledged', 'open', 'escalated', 'dismissed', 'open', 'dismissed', 'open'];
    for (let i = 0; i < sigAlerts.length; i++) {
      const s = sigAlerts[i];
      await qr.query(`
        INSERT INTO signature_alerts (id, signature_id, signature_name, category, severity, action, source_ip, source_port, destination_ip, destination_port, protocol, timestamp, status)
        VALUES ($1, $2, $3, $4, $5, 'alert', $6, $7, $8, $9, $10, $11, $12)
      `, [uuidv4(), s.sigId, s.name, s.cat, s.sev, s.srcIp, Math.floor(Math.random() * 60000) + 1024, s.dstIp, s.dPort, s.proto, hoursAgo(Math.random() * 48), sigStatuses[i]]);
    }

    // ── 17. DDoS Events (5) ────────────────────────────────────────────────
    console.log('💥 Seeding DDoS events (5)...');
    const ddos = [
      { type: 'volumetric',  sev: 'critical', status: 'active',   ip: '10.0.0.20', bw: 12.5, dur: 1800 },
      { type: 'application', sev: 'high',     status: 'mitigated', ip: '10.0.10.1', bw: 3.2,  dur: 3600 },
      { type: 'protocol',    sev: 'high',     status: 'mitigated', ip: '10.0.0.1',  bw: 8.0,  dur: 900 },
      { type: 'volumetric',  sev: 'medium',   status: 'resolved',  ip: '172.31.1.10', bw: 5.5, dur: 7200 },
      { type: 'scanning',    sev: 'low',      status: 'resolved',  ip: '10.0.0.10', bw: 0.5,  dur: 600 },
    ];
    for (const d of ddos) {
      const detectedAt = hoursAgo(d.status === 'active' ? 0.5 : randomBetween(2, 48));
      await qr.query(`
        INSERT INTO ddos_events (id, attack_type, severity, status, target_ip, target_asset_name, peak_bandwidth_gbps, peak_pps, total_packets, total_bytes, duration_seconds, description, detected_at, mitigated_at, resolved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        uuidv4(), d.type, d.sev, d.status, d.ip,
        assets.find(a => a.ip === d.ip)?.name || 'unknown',
        d.bw, Math.floor(d.bw * 1_000_000),
        Math.floor(d.bw * 1_000_000 * d.dur), Math.floor(d.bw * 1_000_000_000 * d.dur / 8),
        d.dur,
        `${d.type} DDoS attack targeting ${d.ip}`,
        detectedAt,
        d.status !== 'active' ? new Date(detectedAt.getTime() + 600_000) : null,
        d.status === 'resolved' ? new Date(detectedAt.getTime() + d.dur * 1000) : null,
      ]);
    }

    // ── 18. License ─────────────────────────────────────────────────────────
    console.log('🔑 Seeding license...');
    const signingSecret = process.env.LICENSE_SIGNING_SECRET || 'canaris_license_signing_key_change_in_production_2026';
    const licenseKey = generateLicenseKey(signingSecret);
    const licenseId = uuidv4();
    const now = new Date();
    await qr.query(`
      INSERT INTO licenses (id, "licenseKey", type, tier, status, "organizationName", "maxDeviceCount", "startsAt", "expiresAt", "gracePeriodDays", "activatedAt", "lastValidatedAt", metadata, "enabledFeatures")
      VALUES ($1, $2, 'subscription', 'ems_full', 'active', 'Canaris Networks', 1000, $3, $4, 7, $3, $5, '{}', $6)
    `, [licenseId, licenseKey, daysAgo(30), daysFromNow(335), now, JSON.stringify(['nms_monitoring', 'ems_analytics', 'security_module', 'cloud_integration', 'apm'])]);

    // ── 19. License Audit Logs ──────────────────────────────────────────────
    console.log('📝 Seeding license audit logs (3)...');
    for (const [action, daysBack] of [['created', 30], ['activated', 30], ['validated', 0]] as const) {
      await qr.query(`
        INSERT INTO license_audit_logs (id, "licenseId", action, details, "performedBy", "ipAddress", "previousState", "newState", "createdAt")
        VALUES ($1, $2, $3, $4, $5, '10.0.0.1', '{}', '{}', $6)
      `, [uuidv4(), licenseId, action, `License ${action}`, action === 'validated' ? 'system' : 'admin', daysAgo(daysBack)]);
    }

    // ── 20. Report Definitions ──────────────────────────────────────────────
    console.log('📄 Seeding report definitions (3)...');
    await qr.query(`
      INSERT INTO report_definitions (id, report_name, report_type, description, format, parameters, include_charts, include_summary, is_template, is_public, created_by) VALUES
      (1, 'SLA Compliance Report',    'sla',         'Monthly SLA compliance for all devices',        'pdf',   '{"dateRange":"monthly","includeDowntime":true}',  true, true, true, true, 1),
      (2, 'Performance Summary',      'performance', 'Weekly performance metrics across infrastructure', 'excel', '{"dateRange":"weekly","metrics":["cpu","memory","bandwidth"]}', true, true, false, true, 1),
      (3, 'Alert Activity Report',    'alerts',      'Daily alert summary with resolution times',     'pdf',   '{"dateRange":"daily","includeResolution":true}',   true, true, false, false, 1)
    `);
    await qr.query(`SELECT setval('report_definitions_id_seq', 3)`);

    // ── 21. Dashboard Configurations ────────────────────────────────────────
    console.log('📋 Seeding dashboard configurations (2)...');
    await qr.query(`
      INSERT INTO dashboard_configurations (id, dashboard_name, description, layout, widgets, refresh_interval, is_default, is_public, user_id, theme, created_by) VALUES
      (1, 'NOC Overview',       'Network Operations Center main dashboard', '{"cols":12,"rowHeight":80}',
        '[{"id":"w1","type":"device-status","title":"Device Health","x":0,"y":0,"w":4,"h":3},{"id":"w2","type":"alert-summary","title":"Active Alerts","x":4,"y":0,"w":4,"h":3},{"id":"w3","type":"traffic-chart","title":"Traffic","x":8,"y":0,"w":4,"h":3}]',
        60, true, true, 1, 'dark', 1),
      (2, 'Security Dashboard', 'Security operations overview', '{"cols":12,"rowHeight":80}',
        '[{"id":"w1","type":"ioc-feed","title":"IOC Feed","x":0,"y":0,"w":6,"h":3},{"id":"w2","type":"ddos-monitor","title":"DDoS Monitor","x":6,"y":0,"w":6,"h":3}]',
        30, false, true, 1, 'dark', 1)
    `);
    await qr.query(`SELECT setval('dashboard_configurations_id_seq', 2)`);

    console.log('');
    console.log('✅ Seeding complete!');
    console.log('   Roles: 4 | Users: 5 | Customers: 5 | Assets: 20');
    console.log('   Interfaces: ~40 | Connections: 15 | Health: 20 | Rules: 6');
    console.log('   Metrics: 100 | History: 100 | Flows: 50');
    console.log('   Events: 15 | Alerts: 8');
    console.log('   SSL Certs: 8 | IOCs: 10 | Sig Alerts: 10 | DDoS: 5');
    console.log('   License: 1 | Audit Logs: 3');
    console.log('   Reports: 3 | Dashboards: 2');
    console.log('');
    console.log('   Login: admin / Admin@123456');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seed().catch(() => process.exit(1));
