/**
 * Sophos Firewall Seed Script
 * Seeds 20 Sophos XGS firewalls into the assets table with SNMP metadata
 * and initial device_health rows.
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/seed-sophos-firewalls.ts
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
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

// ─── Sophos Firewall Definitions ──────────────────────────────────────────────

interface SophosDevice {
  name: string;
  ip: string;
  model: string;
  location: string;
  tier: number;
  community: string;
  tags: string[];
  role: string; // description of device role
}

const sophosFirewalls: SophosDevice[] = [
  // ── HQ Firewalls (192.168.1.x) ──
  {
    name: 'sophos-hq-fw-01',
    ip: '192.168.1.1',
    model: 'XGS 4300',
    location: 'HQ Data Center - Rack A1',
    tier: 1,
    community: 'bankro',
    tags: ['hq', 'perimeter', 'critical'],
    role: 'HQ primary perimeter firewall',
  },
  {
    name: 'sophos-hq-fw-02',
    ip: '192.168.1.2',
    model: 'XGS 4300',
    location: 'HQ Data Center - Rack A2',
    tier: 1,
    community: 'bankro',
    tags: ['hq', 'perimeter', 'ha-secondary'],
    role: 'HQ HA secondary perimeter firewall',
  },
  {
    name: 'sophos-hq-internal-01',
    ip: '192.168.1.3',
    model: 'XGS 2300',
    location: 'HQ Data Center - Rack B1',
    tier: 1,
    community: 'bankro',
    tags: ['hq', 'internal', 'segmentation'],
    role: 'HQ internal segmentation firewall',
  },

  // ── Branch Firewalls (192.168.10-17.1) ──
  {
    name: 'sophos-branch-mum-01',
    ip: '192.168.10.1',
    model: 'XGS 136',
    location: 'Mumbai Branch Office',
    tier: 2,
    community: 'bankro',
    tags: ['branch', 'mumbai'],
    role: 'Mumbai branch gateway firewall',
  },
  {
    name: 'sophos-branch-del-01',
    ip: '192.168.11.1',
    model: 'XGS 136',
    location: 'Delhi Branch Office',
    tier: 2,
    community: 'bankro',
    tags: ['branch', 'delhi'],
    role: 'Delhi branch gateway firewall',
  },
  {
    name: 'sophos-branch-blr-01',
    ip: '192.168.12.1',
    model: 'XGS 136',
    location: 'Bangalore Branch Office',
    tier: 2,
    community: 'bankro',
    tags: ['branch', 'bangalore'],
    role: 'Bangalore branch gateway firewall',
  },
  {
    name: 'sophos-branch-chn-01',
    ip: '192.168.13.1',
    model: 'XGS 136',
    location: 'Chennai Branch Office',
    tier: 2,
    community: 'bankro',
    tags: ['branch', 'chennai'],
    role: 'Chennai branch gateway firewall',
  },
  {
    name: 'sophos-branch-hyd-01',
    ip: '192.168.14.1',
    model: 'XGS 136',
    location: 'Hyderabad Branch Office',
    tier: 2,
    community: 'bankro',
    tags: ['branch', 'hyderabad'],
    role: 'Hyderabad branch gateway firewall',
  },
  {
    name: 'sophos-branch-pun-01',
    ip: '192.168.15.1',
    model: 'XGS 87',
    location: 'Pune Branch Office',
    tier: 3,
    community: 'bankro',
    tags: ['branch', 'pune'],
    role: 'Pune branch gateway firewall',
  },
  {
    name: 'sophos-branch-kol-01',
    ip: '192.168.16.1',
    model: 'XGS 87',
    location: 'Kolkata Branch Office',
    tier: 3,
    community: 'bankro',
    tags: ['branch', 'kolkata'],
    role: 'Kolkata branch gateway firewall',
  },
  {
    name: 'sophos-branch-ahm-01',
    ip: '192.168.17.1',
    model: 'XGS 87',
    location: 'Ahmedabad Branch Office',
    tier: 3,
    community: 'bankro',
    tags: ['branch', 'ahmedabad'],
    role: 'Ahmedabad branch gateway firewall',
  },

  // ── DC Firewalls (10.100.0.x / 10.200.0.x) ──
  {
    name: 'sophos-dc1-fw-01',
    ip: '10.100.0.1',
    model: 'XGS 4300',
    location: 'Primary DC - Rack C1',
    tier: 1,
    community: 'public',
    tags: ['dc', 'primary', 'critical'],
    role: 'Primary DC perimeter firewall',
  },
  {
    name: 'sophos-dc1-fw-02',
    ip: '10.100.0.2',
    model: 'XGS 2300',
    location: 'Primary DC - Rack C2',
    tier: 1,
    community: 'public',
    tags: ['dc', 'primary', 'internal'],
    role: 'Primary DC internal zone firewall',
  },
  {
    name: 'sophos-dc2-fw-01',
    ip: '10.200.0.1',
    model: 'XGS 4300',
    location: 'DR Site - Rack A1',
    tier: 1,
    community: 'public',
    tags: ['dc', 'dr', 'critical'],
    role: 'DR site perimeter firewall',
  },
  {
    name: 'sophos-dc2-fw-02',
    ip: '10.200.0.2',
    model: 'XGS 2300',
    location: 'DR Site - Rack A2',
    tier: 1,
    community: 'public',
    tags: ['dc', 'dr', 'internal'],
    role: 'DR site internal zone firewall',
  },

  // ── VPN Concentrators (172.16.0.x) ──
  {
    name: 'sophos-vpn-01',
    ip: '172.16.0.1',
    model: 'XGS 2300',
    location: 'HQ Data Center - Rack D1',
    tier: 1,
    community: 'bankro',
    tags: ['vpn', 'concentrator', 'critical'],
    role: 'Primary VPN concentrator (site-to-site + remote)',
  },
  {
    name: 'sophos-vpn-02',
    ip: '172.16.0.2',
    model: 'XGS 2300',
    location: 'Primary DC - Rack D1',
    tier: 2,
    community: 'bankro',
    tags: ['vpn', 'concentrator', 'backup'],
    role: 'Secondary VPN concentrator (failover)',
  },

  // ── Guest / DMZ Firewalls (192.168.100.x) ──
  {
    name: 'sophos-guest-fw-01',
    ip: '192.168.100.1',
    model: 'XGS 136',
    location: 'HQ - Guest Network Zone',
    tier: 3,
    community: 'public',
    tags: ['guest', 'dmz'],
    role: 'Guest network isolation firewall',
  },
  {
    name: 'sophos-dmz-fw-01',
    ip: '192.168.100.2',
    model: 'XGS 2300',
    location: 'HQ Data Center - DMZ Rack',
    tier: 1,
    community: 'public',
    tags: ['dmz', 'web-facing'],
    role: 'DMZ web-facing services firewall',
  },

  // ── Remote Office (192.168.201-202.x) ──
  {
    name: 'sophos-remote-goa-01',
    ip: '192.168.201.1',
    model: 'XGS 87',
    location: 'Goa Remote Office',
    tier: 3,
    community: 'bankro',
    tags: ['remote', 'goa'],
    role: 'Goa remote office firewall',
  },
  {
    name: 'sophos-remote-jpr-01',
    ip: '192.168.202.1',
    model: 'XGS 87',
    location: 'Jaipur Remote Office',
    tier: 3,
    community: 'bankro',
    tags: ['remote', 'jaipur'],
    role: 'Jaipur remote office firewall',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedSophosFirewalls() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();

  try {
    console.log(`Seeding ${sophosFirewalls.length} Sophos firewalls...`);

    const assetIds: string[] = [];

    for (const fw of sophosFirewalls) {
      const assetId = uuidv4();
      assetIds.push(assetId);

      // Check if asset already exists by IP
      const existing = await qr.query(
        `SELECT id FROM assets WHERE ip = $1`,
        [fw.ip],
      );

      if (existing.length > 0) {
        console.log(`  SKIP ${fw.name} (${fw.ip}) — already exists`);
        assetIds[assetIds.length - 1] = existing[0].id;
        continue;
      }

      // Insert asset
      await qr.query(
        `INSERT INTO assets (
          id, name, type, ip, location, vendor, model, tags, tier, owner,
          status, "monitoringEnabled", metadata, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'firewall', $3, $4, 'Sophos', $5, $6, $7, 'network-ops',
          'unknown', true, $8, NOW(), NOW()
        )`,
        [
          assetId,
          fw.name,
          fw.ip,
          fw.location,
          fw.model,
          fw.tags.join(','),
          fw.tier,
          JSON.stringify({
            snmp_community: fw.community,
            snmp_version: 'v2c',
            snmp_port: 161,
            snmp_timeout: 5000,
            snmp_retries: 2,
            isSophos: true,
            role: fw.role,
            deviceFamily: 'Sophos XGS',
          }),
        ],
      );

      console.log(`  + ${fw.name} (${fw.ip}) — ${fw.model} [${fw.community}]`);
    }

    // Create initial device_health rows
    console.log('\nCreating initial device_health rows...');
    for (let i = 0; i < assetIds.length; i++) {
      const assetId = assetIds[i];

      const existingHealth = await qr.query(
        `SELECT id FROM device_health WHERE asset_id = $1`,
        [assetId],
      );

      if (existingHealth.length > 0) {
        console.log(`  SKIP health for ${sophosFirewalls[i].name} — already exists`);
        continue;
      }

      await qr.query(
        `INSERT INTO device_health (
          asset_id, status, health_score, is_critical,
          cpu_utilization, memory_utilization, disk_utilization,
          bandwidth_in_mbps, bandwidth_out_mbps,
          packet_loss_percent, latency_ms,
          total_interfaces, interfaces_up, interfaces_down,
          uptime_percent_24h, uptime_percent_7d, uptime_percent_30d,
          sla_compliance, sla_target_percent,
          last_health_check, created_at, updated_at
        ) VALUES (
          $1, 'unknown', 0, $2,
          NULL, NULL, NULL,
          NULL, NULL,
          NULL, NULL,
          0, 0, 0,
          NULL, NULL, NULL,
          true, $3,
          NULL, NOW(), NOW()
        )`,
        [
          assetId,
          sophosFirewalls[i].tier === 1,
          sophosFirewalls[i].tier === 1 ? '99.9' : sophosFirewalls[i].tier === 2 ? '99.5' : '99.0',
        ],
      );

      console.log(`  + health: ${sophosFirewalls[i].name}`);
    }

    // Summary
    console.log('\n--- Seed Summary ---');
    console.log(`Total Sophos firewalls: ${sophosFirewalls.length}`);
    console.log(`  HQ firewalls: 3`);
    console.log(`  Branch firewalls: 8`);
    console.log(`  DC firewalls: 4`);
    console.log(`  VPN concentrators: 2`);
    console.log(`  Guest/DMZ firewalls: 2`);
    console.log(`  Remote office: 2`);
    console.log('');
    console.log('Community strings used:');
    console.log(`  bankro: ${sophosFirewalls.filter((f) => f.community === 'bankro').length} devices`);
    console.log(`  public: ${sophosFirewalls.filter((f) => f.community === 'public').length} devices`);
    console.log('');
    console.log('Done! Start SNMP polling with SNMP_MODE=production to begin monitoring.');
  } catch (error: any) {
    console.error('Seed failed:', error.message);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

seedSophosFirewalls().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
