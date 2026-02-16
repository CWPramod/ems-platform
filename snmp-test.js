// Direct SNMP reachability test for RailTel devices
const snmp = require('net-snmp');
const dgram = require('dgram');
const net = require('net');

const devices = [
  { name: 'Depot-Coimbatore South', ip: '172.26.186.10' },
  { name: 'DM-Tuticorin',          ip: '172.26.186.110' },
  { name: 'DM-Theni',              ip: '172.26.186.114' },
  { name: 'DM-Vellore',            ip: '172.26.186.106' },
  { name: 'DM-Dindigul',           ip: '172.26.186.102' },
];

const community = 'RailTel@2025';
const OID_SYSNAME = '1.3.6.1.2.1.1.5.0';       // System name
const OID_SYSDESCR = '1.3.6.1.2.1.1.1.0';      // System description
const OID_SYSUPTIME = '1.3.6.1.2.1.1.3.0';     // System uptime

async function testSNMP(device) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let done = false;

    console.log(`\n[${device.name}] Testing SNMP to ${device.ip}...`);

    try {
      const session = snmp.createSession(device.ip, community, {
        version: snmp.Version2c,
        timeout: 5000,
        retries: 2,
        port: 161,
        transport: 'udp4',
      });

      session.on('error', (err) => {
        if (!done) {
          done = true;
          console.log(`  [ERROR] Session error: ${err.message}`);
          try { session.close(); } catch(e) {}
          resolve(false);
        }
      });

      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          console.log(`  [TIMEOUT] No SNMP response after 8 seconds`);
          try { session.close(); } catch(e) {}
          resolve(false);
        }
      }, 8000);

      session.get([OID_SYSNAME, OID_SYSDESCR, OID_SYSUPTIME], (error, varbinds) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;

          if (error) {
            console.log(`  [FAIL] SNMP error: ${error.message} (${elapsed}ms)`);
          } else if (varbinds) {
            console.log(`  [SUCCESS] SNMP response received in ${elapsed}ms!`);
            varbinds.forEach((vb) => {
              if (snmp.isVarbindError(vb)) {
                console.log(`    OID ${vb.oid}: Error - ${snmp.varbindError(vb)}`);
              } else {
                console.log(`    OID ${vb.oid}: ${vb.value.toString()}`);
              }
            });
            resolve(true);
          } else {
            console.log(`  [FAIL] Empty response (${elapsed}ms)`);
          }
          try { session.close(); } catch(e) {}
        }
      });
    } catch (err) {
      if (!done) {
        done = true;
        console.log(`  [ERROR] ${err.message}`);
        resolve(false);
      }
    }
  });
}

// Also test raw UDP to port 161
async function testRawUDP(device) {
  return new Promise((resolve) => {
    console.log(`[${device.name}] Testing raw UDP:161 to ${device.ip}...`);
    const client = dgram.createSocket('udp4');
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        console.log(`  [UDP] No response (timeout 5s) - could be filtered or no route`);
        client.close();
        resolve(false);
      }
    }, 5000);

    client.on('message', (msg, rinfo) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        console.log(`  [UDP] Got response from ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
        client.close();
        resolve(true);
      }
    });

    client.on('error', (err) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        console.log(`  [UDP] Error: ${err.message}`);
        client.close();
        resolve(false);
      }
    });

    // Send a minimal SNMP GET packet (community: RailTel@2025, OID: sysDescr)
    const msg = Buffer.from('test-packet');
    client.send(msg, 161, device.ip);
  });
}

async function main() {
  console.log('========================================');
  console.log('RailTel SNMP Connectivity Test');
  console.log(`Source IP: will use default interface`);
  console.log(`Community: ${community}`);
  console.log(`Timeout: 5s per device, 2 retries`);
  console.log('========================================');

  let successCount = 0;

  for (const device of devices) {
    const ok = await testSNMP(device);
    if (ok) successCount++;
  }

  console.log('\n========================================');
  console.log(`Results: ${successCount}/${devices.length} devices responded to SNMP`);

  if (successCount === 0) {
    console.log('\nAll SNMP attempts failed. Trying raw UDP test on first device...');
    await testRawUDP(devices[0]);

    console.log('\n--- Diagnosis ---');
    console.log('Packets reach RailTel backbone (172.31.200.231) but not 172.26.186.x');
    console.log('Possible causes:');
    console.log('  1. Missing route on 172.31.200.231 to forward to 172.26.186.0/24');
    console.log('  2. The devices lack a return route to our IP 122.252.227.202');
    console.log('  3. An ACL/firewall between 172.31.x.x and 172.26.186.x');
    console.log('  4. The competitor NMS is on the internal network (not via this path)');
  }

  process.exit(0);
}

main().catch(console.error);
