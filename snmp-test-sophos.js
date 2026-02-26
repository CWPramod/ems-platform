#!/usr/bin/env node
/**
 * Sophos SNMP Connectivity Test Script
 * Tests SNMP reachability for all 20 Sophos firewalls.
 *
 * Usage: node snmp-test-sophos.js
 *
 * Requires: npm install net-snmp (already a dependency)
 */

const snmp = require('net-snmp');

// ── Device Definitions ──────────────────────────────────────────────────────

const devices = [
  // HQ Firewalls
  { name: 'sophos-hq-fw-01',       ip: '192.168.1.1',   community: 'bankro', group: 'HQ' },
  { name: 'sophos-hq-fw-02',       ip: '192.168.1.2',   community: 'bankro', group: 'HQ' },
  { name: 'sophos-hq-internal-01', ip: '192.168.1.3',   community: 'bankro', group: 'HQ' },
  // Branch Firewalls
  { name: 'sophos-branch-mum-01',  ip: '192.168.10.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-del-01',  ip: '192.168.11.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-blr-01',  ip: '192.168.12.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-chn-01',  ip: '192.168.13.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-hyd-01',  ip: '192.168.14.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-pun-01',  ip: '192.168.15.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-kol-01',  ip: '192.168.16.1',  community: 'bankro', group: 'Branch' },
  { name: 'sophos-branch-ahm-01',  ip: '192.168.17.1',  community: 'bankro', group: 'Branch' },
  // DC Firewalls
  { name: 'sophos-dc1-fw-01',      ip: '10.100.0.1',    community: 'public', group: 'DC' },
  { name: 'sophos-dc1-fw-02',      ip: '10.100.0.2',    community: 'public', group: 'DC' },
  { name: 'sophos-dc2-fw-01',      ip: '10.200.0.1',    community: 'public', group: 'DC' },
  { name: 'sophos-dc2-fw-02',      ip: '10.200.0.2',    community: 'public', group: 'DC' },
  // VPN Concentrators
  { name: 'sophos-vpn-01',         ip: '172.16.0.1',    community: 'bankro', group: 'VPN' },
  { name: 'sophos-vpn-02',         ip: '172.16.0.2',    community: 'bankro', group: 'VPN' },
  // Guest / DMZ
  { name: 'sophos-guest-fw-01',    ip: '192.168.100.1', community: 'public', group: 'Guest/DMZ' },
  { name: 'sophos-dmz-fw-01',      ip: '192.168.100.2', community: 'public', group: 'Guest/DMZ' },
  // Remote Office
  { name: 'sophos-remote-goa-01',  ip: '192.168.201.1', community: 'bankro', group: 'Remote' },
  { name: 'sophos-remote-jpr-01',  ip: '192.168.202.1', community: 'bankro', group: 'Remote' },
];

// OIDs to test
const OIDs = {
  sysDescr:  '1.3.6.1.2.1.1.1.0',
  sysName:   '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
};

// ── Test Functions ──────────────────────────────────────────────────────────

function testDevice(device, community, timeout = 3000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let responded = false;

    try {
      const session = snmp.createSession(device.ip, community, {
        version: snmp.Version2c,
        timeout: timeout,
        retries: 1,
      });

      const timer = setTimeout(() => {
        if (!responded) {
          responded = true;
          try { session.close(); } catch (_) {}
          resolve({
            device: device.name,
            ip: device.ip,
            community: community,
            reachable: false,
            responseTimeMs: Date.now() - startTime,
            sysDescr: null,
            sysName: null,
            error: 'Timeout',
          });
        }
      }, timeout + 500);

      session.get(
        [OIDs.sysDescr, OIDs.sysName, OIDs.sysUpTime],
        (error, varbinds) => {
          if (!responded) {
            responded = true;
            clearTimeout(timer);
            const responseTimeMs = Date.now() - startTime;
            try { session.close(); } catch (_) {}

            if (error) {
              resolve({
                device: device.name,
                ip: device.ip,
                community: community,
                reachable: false,
                responseTimeMs,
                sysDescr: null,
                sysName: null,
                error: error.message,
              });
            } else {
              resolve({
                device: device.name,
                ip: device.ip,
                community: community,
                reachable: true,
                responseTimeMs,
                sysDescr: varbinds[0]?.value?.toString() || '',
                sysName: varbinds[1]?.value?.toString() || '',
                uptimeSeconds: parseInt(varbinds[2]?.value?.toString() || '0') / 100,
                error: null,
              });
            }
          }
        }
      );
    } catch (err) {
      resolve({
        device: device.name,
        ip: device.ip,
        community: community,
        reachable: false,
        responseTimeMs: Date.now() - startTime,
        sysDescr: null,
        sysName: null,
        error: err.message,
      });
    }
  });
}

async function testAllDevices() {
  console.log('==========================================================');
  console.log('  Sophos Firewall SNMP Connectivity Test');
  console.log(`  Testing ${devices.length} devices`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log('==========================================================\n');

  const results = [];
  let reachable = 0;
  let unreachable = 0;

  // Group devices for display
  const groups = {};
  for (const device of devices) {
    if (!groups[device.group]) groups[device.group] = [];
    groups[device.group].push(device);
  }

  for (const [groupName, groupDevices] of Object.entries(groups)) {
    console.log(`\n--- ${groupName} ---`);

    for (const device of groupDevices) {
      // Test with configured community first
      let result = await testDevice(device, device.community);

      // If configured community fails, try alternate
      if (!result.reachable) {
        const altCommunity = device.community === 'bankro' ? 'public' : 'bankro';
        const altResult = await testDevice(device, altCommunity);
        if (altResult.reachable) {
          result = altResult;
          console.log(`  NOTE: ${device.name} responded to '${altCommunity}' instead of '${device.community}'`);
        }
      }

      results.push(result);

      if (result.reachable) {
        reachable++;
        const uptimeStr = result.uptimeSeconds
          ? `${Math.floor(result.uptimeSeconds / 86400)}d ${Math.floor((result.uptimeSeconds % 86400) / 3600)}h`
          : 'N/A';
        console.log(
          `  [OK]   ${device.name.padEnd(28)} ${device.ip.padEnd(16)} ` +
          `${result.responseTimeMs}ms  uptime: ${uptimeStr}`
        );
        if (result.sysDescr) {
          console.log(`         sysDescr: ${result.sysDescr.substring(0, 80)}`);
        }
      } else {
        unreachable++;
        console.log(
          `  [FAIL] ${device.name.padEnd(28)} ${device.ip.padEnd(16)} ` +
          `${result.error} (community: ${device.community})`
        );
      }
    }
  }

  // Summary
  console.log('\n==========================================================');
  console.log('  Summary');
  console.log('==========================================================');
  console.log(`  Total devices:   ${devices.length}`);
  console.log(`  Reachable:       ${reachable}`);
  console.log(`  Unreachable:     ${unreachable}`);
  console.log(`  Success rate:    ${((reachable / devices.length) * 100).toFixed(1)}%`);
  console.log('');

  // Community string breakdown
  const bankroDevices = results.filter((r) => r.community === 'bankro');
  const publicDevices = results.filter((r) => r.community === 'public');
  console.log('  By community string:');
  console.log(`    bankro: ${bankroDevices.filter((r) => r.reachable).length}/${bankroDevices.length} reachable`);
  console.log(`    public: ${publicDevices.filter((r) => r.reachable).length}/${publicDevices.length} reachable`);

  // Average response time for reachable devices
  const reachableResults = results.filter((r) => r.reachable);
  if (reachableResults.length > 0) {
    const avgResponseTime = reachableResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / reachableResults.length;
    console.log(`\n  Average response time: ${avgResponseTime.toFixed(0)}ms`);
  }

  console.log('==========================================================\n');

  // Exit with non-zero if any device is unreachable
  if (unreachable > 0) {
    console.log(`WARNING: ${unreachable} device(s) unreachable. Check network connectivity and SNMP configuration.`);
    process.exit(1);
  }

  process.exit(0);
}

// Run
testAllDevices().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(2);
});
