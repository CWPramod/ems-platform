-- ITSM Test Data Seed
-- Seeds tickets, comments, history, problems, changes, KB articles, and ticket links
-- Requires SLA policies to already exist (seeded by sla-policies.seed.ts)
--
-- Usage:
--   docker cp apps/itsm/src/database/seeds/itsm-test-data.sql ems-postgres:/tmp/
--   docker exec ems-postgres psql -U ems_admin -d ems_platform -f /tmp/itsm-test-data.sql

DO $$
DECLARE
  sla_crit UUID; sla_high UUID; sla_med UUID; sla_low UUID;
  t1 UUID; t2 UUID; t3 UUID; t4 UUID; t5 UUID; t6 UUID; t7 UUID;
  t8 UUID; t9 UUID; t10 UUID; t11 UUID; t12 UUID; t13 UUID; t14 UUID; t15 UUID;
  p1 UUID; p2 UUID; p3 UUID; p4 UUID; p5 UUID;
BEGIN
  SELECT id INTO sla_crit FROM sla_policies WHERE severity = 'critical';
  SELECT id INTO sla_high FROM sla_policies WHERE severity = 'high';
  SELECT id INTO sla_med  FROM sla_policies WHERE severity = 'medium';
  SELECT id INTO sla_low  FROM sla_policies WHERE severity = 'low';

  -- ── TICKETS ──────────────────────────────────────────────

  t1 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t1, 'INC-20260222-0002', 'Database replication lag exceeding 30s', 'PostgreSQL streaming replication between db-srv-01 and db-srv-02 showing 30+ second lag.', 'incident', 'critical', 'P1', 'in_progress', 'john.operator', 'system', sla_crit, NOW() - INTERVAL '5 minutes', true, 'auto_alert', NOW() - INTERVAL '70 minutes', NOW() - INTERVAL '15 minutes');

  t2 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t2, 'INC-20260224-0002', 'Firewall HA pair split-brain detected', 'Both fw-primary and fw-secondary claim active role. Asymmetric routing causing intermittent connectivity.', 'incident', 'critical', 'P1', 'open', NULL, 'system', sla_crit, NOW() + INTERVAL '45 minutes', false, 'auto_alert', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes');

  t3 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t3, 'INC-20260221-0001', 'SSL certificate expired on api.canaris.io', 'Production API endpoint returning certificate errors. Customer-facing services impacted.', 'incident', 'high', 'P2', 'resolved', 'sarah.admin', 'admin', sla_high, NOW() - INTERVAL '2 hours', false, 'manual', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour');

  t4 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t4, 'INC-20260223-0002', 'BGP session flapping with ISP-A', 'BGP peering with upstream ISP-A flapping every 3-5 minutes. Route withdrawals and rerouting via ISP-B.', 'incident', 'high', 'P2', 'pending', 'john.operator', 'admin', sla_high, NOW() + INTERVAL '2 hours', false, 'manual', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '30 minutes');

  t5 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t5, 'INC-20260222-0003', 'Load balancer health checks failing for web-vm-02', 'F5 BIG-IP marking web-vm-02 as down. HTTP health check returning 503. App logs show OOM kills.', 'incident', 'high', 'P2', 'resolved', 'john.operator', 'admin', sla_high, NOW() - INTERVAL '10 hours', false, 'auto_alert', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '12 hours');

  t6 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t6, 'INC-20260219-0001', 'SNMP polling timeout on Delhi edge router', 'SNMP v3 polling from NMS to edge-rtr-del timing out. Device reachable via SSH. Suspect SNMP process crash.', 'incident', 'high', 'P2', 'closed', 'john.operator', 'admin', sla_high, NOW() - INTERVAL '4 days', false, 'manual', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days');

  t7 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t7, 'INC-20260224-0003', 'Disk utilization at 89% on db-srv-01', 'PostgreSQL data directory consuming 890GB of 1TB. Growth rate ~5GB/day. Need to archive old partitions.', 'incident', 'medium', 'P3', 'acknowledged', 'sarah.admin', 'admin', sla_med, NOW() + INTERVAL '6 hours', false, 'auto_alert', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour');

  t8 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t8, 'INC-20260223-0003', 'NTP synchronization drift on Bangalore switches', 'access-sw-blr showing 500ms+ clock drift. SNMP traps timestamped incorrectly.', 'incident', 'medium', 'P3', 'in_progress', 'john.operator', 'admin', sla_med, NOW() + INTERVAL '4 hours', false, 'manual', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours');

  t9 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t9, 'INC-20260220-0002', 'VLAN 200 intermittent packet loss', 'Users on VLAN 200 (Engineering) reporting intermittent connectivity. 2-5% packet loss during peak hours.', 'incident', 'medium', 'P3', 'resolved', 'john.operator', 'admin', sla_med, NOW() - INTERVAL '2 days', false, 'manual', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days');

  t10 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t10, 'INC-20260224-0004', 'Scheduled report emails delayed', 'Daily SLA compliance reports not delivered to management DL by 8 AM. SMTP relay queue backed up.', 'incident', 'low', 'P4', 'open', NULL, 'admin', sla_low, NOW() + INTERVAL '20 hours', false, 'manual', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours');

  t11 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t11, 'INC-20260222-0004', 'Stale ARP entries on dist-sw-02', 'ARP table showing stale entries for decommissioned servers. Not impacting traffic but cluttering monitoring.', 'incident', 'low', 'P4', 'closed', 'john.operator', 'admin', sla_low, NOW() - INTERVAL '1 day', false, 'manual', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day');

  t12 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t12, 'INC-20260218-0001', 'AWS EC2 instance unreachable in ap-south-1', 'aws-web-01 not responding to health checks. CloudWatch StatusCheckFailed. Auto-recovery did not trigger.', 'incident', 'high', 'P2', 'resolved', 'sarah.admin', 'system', sla_high, NOW() - INTERVAL '6 days', true, 'auto_alert', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days');

  t13 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t13, 'INC-20260217-0001', 'VPN tunnel to Chennai branch down', 'IPSec tunnel between Mumbai DC and Chennai branch not re-establishing after ISP maintenance.', 'incident', 'critical', 'P1', 'closed', 'john.operator', 'admin', sla_crit, NOW() - INTERVAL '7 days', true, 'manual', NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days');

  t14 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t14, 'INC-20260216-0001', 'Monitoring blind spot - SNMP community string rotated', 'Quarterly SNMP community string rotation done but NMS not updated. 8 devices stopped reporting for 6 hours.', 'incident', 'medium', 'P3', 'closed', 'sarah.admin', 'admin', sla_med, NOW() - INTERVAL '8 days', true, 'manual', NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days');

  t15 := uuid_generate_v4();
  INSERT INTO tickets (id, ticket_number, title, description, type, severity, priority, status, assigned_to, created_by, sla_policy_id, sla_due_at, breached, source, created_at, updated_at) VALUES
  (t15, 'INC-20260224-0005', 'Memory leak in web-vm-01 application', 'Java heap growing unbounded, reaching 95% of 8GB allocation. GC pauses causing request timeouts.', 'incident', 'high', 'P2', 'in_progress', 'sarah.admin', 'admin', sla_high, NOW() + INTERVAL '1 hour', false, 'manual', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour');

  -- ── TICKET COMMENTS ──────────────────────────────────────

  -- Get existing ticket IDs for the first two tickets
  -- Comments for t1 (DB replication lag - breached)
  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at) VALUES
  (t1, 'Replication lag spiked during batch ETL job at 02:00 UTC. WAL sender process shows high write activity.', 'internal', 'john.operator', NOW() - INTERVAL '60 minutes'),
  (t1, 'Increased wal_sender_timeout and max_wal_senders. Lag reducing but still at 15s.', 'internal', 'john.operator', NOW() - INTERVAL '30 minutes'),
  (t1, 'SLA breached. Escalating to database team lead.', 'internal', 'system', NOW() - INTERVAL '5 minutes');

  -- Comments for t3 (SSL expired - resolved)
  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at) VALUES
  (t3, 'Certificate renewal initiated via Lets Encrypt. New cert valid until 2026-05-21.', 'internal', 'sarah.admin', NOW() - INTERVAL '3 hours'),
  (t3, 'New certificate deployed to all API endpoints. SSL Labs score: A+.', 'public', 'sarah.admin', NOW() - INTERVAL '2 hours'),
  (t3, 'Added cert expiry monitoring alert - will trigger 30 days before expiry.', 'internal', 'sarah.admin', NOW() - INTERVAL '1 hour');

  -- Comments for t4 (BGP flapping - pending)
  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at) VALUES
  (t4, 'BGP logs show NOTIFICATION received (Hold Timer Expired). ISP-A contacted.', 'internal', 'john.operator', NOW() - INTERVAL '2 hours'),
  (t4, 'Waiting for ISP-A NOC to provide RFO. Their ticket ref: ISP-A-2026-8843.', 'internal', 'john.operator', NOW() - INTERVAL '30 minutes');

  -- Comments for core router failover (existing INC-20260222-0001)
  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at)
  SELECT id, 'Confirmed HSRP standby priority on core-rtr-02 is set to 90 instead of 110. Preempt disabled.', 'internal', 'john.operator', NOW() - INTERVAL '35 minutes'
  FROM tickets WHERE ticket_number = 'INC-20260222-0001';

  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at)
  SELECT id, 'Manually triggered failover. Traffic restored. Working on permanent fix.', 'internal', 'john.operator', NOW() - INTERVAL '20 minutes'
  FROM tickets WHERE ticket_number = 'INC-20260222-0001';

  -- Comments for t8 (NTP drift)
  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at) VALUES
  (t8, 'NTP server 10.0.10.20 is synced correctly to upstream stratum 1.', 'internal', 'john.operator', NOW() - INTERVAL '3 hours'),
  (t8, 'Issue traced to access-sw-blr NTP client config - using broadcast mode instead of unicast. Reconfiguring.', 'internal', 'john.operator', NOW() - INTERVAL '1 hour');

  -- Comments for t15 (memory leak)
  INSERT INTO ticket_comments (ticket_id, comment, visibility, created_by, created_at) VALUES
  (t15, 'Heap dump captured. Analyzing with Eclipse MAT. Suspect connection pool objects not being released.', 'internal', 'sarah.admin', NOW() - INTERVAL '2 hours'),
  (t15, 'Confirmed: JDBC connection pool leak in UserSessionService. Connections opened in try block but not closed in finally.', 'internal', 'sarah.admin', NOW() - INTERVAL '45 minutes');

  -- ── TICKET HISTORY ───────────────────────────────────────

  INSERT INTO ticket_history (ticket_id, field_changed, old_value, new_value, changed_by, changed_at) VALUES
  (t1, 'status', 'open', 'in_progress', 'john.operator', NOW() - INTERVAL '65 minutes'),
  (t1, 'assigned_to', NULL, 'john.operator', 'system', NOW() - INTERVAL '65 minutes'),
  (t1, 'breached', 'false', 'true', 'system', NOW() - INTERVAL '5 minutes');

  INSERT INTO ticket_history (ticket_id, field_changed, old_value, new_value, changed_by, changed_at) VALUES
  (t3, 'status', 'open', 'in_progress', 'sarah.admin', NOW() - INTERVAL '4 hours'),
  (t3, 'assigned_to', NULL, 'sarah.admin', 'admin', NOW() - INTERVAL '4 hours'),
  (t3, 'status', 'in_progress', 'resolved', 'sarah.admin', NOW() - INTERVAL '1 hour');

  INSERT INTO ticket_history (ticket_id, field_changed, old_value, new_value, changed_by, changed_at) VALUES
  (t4, 'status', 'open', 'in_progress', 'john.operator', NOW() - INTERVAL '2 hours'),
  (t4, 'status', 'in_progress', 'pending', 'john.operator', NOW() - INTERVAL '30 minutes');

  INSERT INTO ticket_history (ticket_id, field_changed, old_value, new_value, changed_by, changed_at) VALUES
  (t7, 'status', 'open', 'acknowledged', 'sarah.admin', NOW() - INTERVAL '1 hour'),
  (t7, 'assigned_to', NULL, 'sarah.admin', 'admin', NOW() - INTERVAL '1 hour');

  INSERT INTO ticket_history (ticket_id, field_changed, old_value, new_value, changed_by, changed_at) VALUES
  (t13, 'status', 'open', 'in_progress', 'john.operator', NOW() - INTERVAL '7 days 22 hours'),
  (t13, 'breached', 'false', 'true', 'system', NOW() - INTERVAL '7 days 23 hours'),
  (t13, 'status', 'in_progress', 'resolved', 'john.operator', NOW() - INTERVAL '7 days 2 hours'),
  (t13, 'status', 'resolved', 'closed', 'admin', NOW() - INTERVAL '7 days');

  INSERT INTO ticket_history (ticket_id, field_changed, old_value, new_value, changed_by, changed_at) VALUES
  (t15, 'status', 'open', 'acknowledged', 'sarah.admin', NOW() - INTERVAL '2 hours 30 minutes'),
  (t15, 'status', 'acknowledged', 'in_progress', 'sarah.admin', NOW() - INTERVAL '2 hours'),
  (t15, 'assigned_to', NULL, 'sarah.admin', 'admin', NOW() - INTERVAL '2 hours 30 minutes');

  -- ── PROBLEMS ─────────────────────────────────────────────

  p1 := uuid_generate_v4();
  INSERT INTO problems (id, title, description, root_cause, status, workaround, created_by, created_at, updated_at) VALUES
  (p1, 'HSRP failover not triggering on core routers', 'Multiple incidents where HSRP failover between core-rtr-01 and core-rtr-02 fails to activate.', 'HSRP standby priority misconfigured during last firmware upgrade. Preempt disabled by maintenance script not rolled back.', 'known_error', 'Manually trigger failover via CLI: standby 1 priority 110 preempt. Long-term fix requires coordinated maintenance window.', 'admin', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour');

  p2 := uuid_generate_v4();
  INSERT INTO problems (id, title, description, root_cause, status, workaround, created_by, created_at, updated_at) VALUES
  (p2, 'Database replication lag during ETL batch jobs', 'PostgreSQL streaming replication consistently lags 15-30s during nightly ETL window (02:00-04:00 UTC).', NULL, 'investigating', NULL, 'admin', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours');

  p3 := uuid_generate_v4();
  INSERT INTO problems (id, title, description, root_cause, status, workaround, created_by, created_at, updated_at) VALUES
  (p3, 'Intermittent SNMP polling failures on Arista switches', 'SNMP v3 polling times out on Arista DCS-7050 switches after firmware update to EOS 4.32.', 'Arista EOS 4.32 known bug where SNMP agent crashes under high polling frequency (< 30s intervals).', 'known_error', 'Increase SNMP polling interval to 60 seconds for Arista devices. Patch expected in EOS 4.32.1 (March 2026).', 'sarah.admin', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days');

  p4 := uuid_generate_v4();
  INSERT INTO problems (id, title, description, root_cause, status, workaround, created_by, created_at, updated_at) VALUES
  (p4, 'SSL certificate renewal process gaps', 'Multiple expired certificate incidents. No automated renewal or pre-expiry alerting.', 'Manual certificate management with no automation. Renewal tracked in spreadsheet not maintained.', 'resolved', NULL, 'admin', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

  p5 := uuid_generate_v4();
  INSERT INTO problems (id, title, description, root_cause, status, workaround, created_by, created_at, updated_at) VALUES
  (p5, 'AWS auto-recovery not functioning for ap-south-1', 'EC2 instances in ap-south-1 not auto-recovering after StatusCheckFailed alarms.', NULL, 'open', 'Manually stop and start (not reboot) the affected instance to force hardware migration.', 'sarah.admin', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days');

  -- Link tickets to problems
  UPDATE tickets SET problem_id = p2 WHERE id = t1;
  UPDATE tickets SET problem_id = p4 WHERE id = t3;
  UPDATE tickets SET problem_id = p5 WHERE id = t12;

  -- ── CHANGES ──────────────────────────────────────────────

  INSERT INTO changes (title, description, risk_level, approval_status, scheduled_start, scheduled_end, created_by, created_at, updated_at) VALUES
  ('Deploy HSRP configuration fix on core routers', 'Update HSRP priority and enable preempt on core-rtr-01 and core-rtr-02.', 'high', 'approved', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 2 hours', 'admin', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes'),
  ('Migrate PostgreSQL replica to NVMe storage', 'Move db-srv-02 data directory from SATA SSD to NVMe for better replication throughput.', 'medium', 'pending_approval', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 4 hours', 'sarah.admin', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
  ('Update Arista switches to EOS 4.32.1', 'Apply firmware patch to resolve SNMP agent crash bug on access-sw-del and access-sw-blr.', 'medium', 'draft', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days 3 hours', 'john.operator', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('Implement automated SSL certificate renewal', 'Deploy cert-manager with Lets Encrypt for all public-facing endpoints.', 'low', 'implemented', NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours', 'sarah.admin', NOW() - INTERVAL '3 days', NOW() - INTERVAL '20 hours'),
  ('Firewall HA configuration audit and fix', 'Audit and correct HA config on fw-primary and fw-secondary to prevent split-brain.', 'critical', 'pending_approval', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 3 hours', 'admin', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'),
  ('Network-wide NTP standardization', 'Standardize NTP config across all network devices to use unicast mode with dual NTP sources.', 'low', 'approved', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 2 hours', 'john.operator', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day');

  -- ── KB ARTICLES ──────────────────────────────────────────

  INSERT INTO kb_articles (title, content, version, status, created_by, created_at, updated_at) VALUES
  ('HSRP Failover Troubleshooting Guide', E'# HSRP Failover Troubleshooting\n\n## Quick Checks\n1. Verify HSRP state: show standby brief\n2. Check priority: Active router should have higher priority\n3. Verify preempt is enabled: standby 1 preempt\n4. Check timers: Default hello=3s, hold=10s\n\n## Common Issues\n- Preempt disabled: Standby wont take over even with higher priority\n- Priority mismatch: After firmware upgrade, priority may reset to default\n- Interface tracking: Track object may be monitoring wrong interface\n\n## Resolution\ninterface GigE0/0\n  standby 1 priority 110\n  standby 1 preempt\n  standby 1 track 1 decrement 20', 2, 'published', 'admin', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 hour'),

  ('PostgreSQL Replication Lag Investigation', E'# PostgreSQL Replication Lag Troubleshooting\n\n## Check Current Lag\nSELECT client_addr, state, sent_lsn, replay_lsn, pg_wal_lsn_diff(sent_lsn, replay_lsn) AS byte_lag FROM pg_stat_replication;\n\n## Common Causes\n1. Heavy write load from ETL/batch jobs\n2. Insufficient network bandwidth\n3. Slow disk I/O on replica\n4. Low wal_sender_timeout or max_wal_senders\n\n## Mitigation\n- Increase max_wal_senders to at least 5\n- Set wal_keep_size = 1GB\n- Consider NVMe storage for replica WAL directory', 1, 'published', 'sarah.admin', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),

  ('SSL Certificate Renewal SOP', E'# SSL Certificate Renewal SOP\n\n## Automated Renewal (cert-manager)\n1. cert-manager watches expiry dates\n2. Auto-renewal triggers 30 days before expiry\n3. New cert deployed automatically\n4. Alert fires if renewal fails\n\n## Manual Renewal (Emergency)\ncertbot certonly --dns-route53 -d api.canaris.io\n\n## Verification\nopenssl s_client -connect api.canaris.io:443 | openssl x509 -noout -dates\n\n## Monitoring\n- Warning: 30 days before expiry\n- Critical: 7 days before expiry', 1, 'published', 'sarah.admin', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  ('BGP Peering Troubleshooting Runbook', E'# BGP Peering Troubleshooting\n\n## Step 1: Check BGP State\nshow ip bgp summary\nshow ip bgp neighbors <peer-ip>\n\n## Step 2: Common Failures\n- Hold Timer Expired: Keepalives not received\n- NOTIFICATION: Check error code/subcode\n- TCP reset: Firewall blocking TCP 179\n\n## Step 3: Verify\n- MTU matches on both sides\n- TTL sufficient for multihop eBGP\n- MD5 key matches\n- Max prefix limit not exceeded\n\n## Escalation\nOpen ticket with ISP NOC referencing AS number and peering IP.', 1, 'published', 'john.operator', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),

  ('Arista EOS SNMP Agent Bug Workaround', E'# Arista EOS 4.32 SNMP Bug\n\n## Affected: EOS 4.32.0F, 4.32.0.1F\n\n## Symptoms\n- SNMP agent crashes under high polling frequency (< 30s)\n- Poll responses intermittently timeout\n- Syslog: snmpd segfault\n\n## Workaround\n1. Increase NMS polling interval to 60s\n2. Add to EOS config:\nsnmp-server engineID local random\nsnmp-server host 10.0.10.20 version 3 auth ems_user\n\n## Fix: Upgrade to EOS 4.32.1 (March 2026)\nTAC Case: Arista-SR-2026-0892', 1, 'published', 'john.operator', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  ('Firewall HA Split-Brain Recovery', E'# Firewall HA Split-Brain Recovery\n\nDANGER: May cause brief traffic interruption\n\n## Identification\nshow high-availability all\nBoth units showing active = split-brain confirmed.\n\n## Recovery Steps\n1. Identify primary unit (check serial, config revision)\n2. On SECONDARY: request high-availability state suspend\n3. Wait 30 seconds for traffic convergence\n4. On suspended unit: request high-availability state functional\n5. Verify: show high-availability all (active/passive)\n\n## Root Cause\n- Check HA heartbeat link\n- Verify HA1/HA2 cables\n- Review heartbeat failure logs', 1, 'draft', 'admin', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes');

  -- ── TICKET LINKS ─────────────────────────────────────────

  INSERT INTO ticket_links (source_ticket_id, target_ticket_id, link_type, created_by) VALUES
  (t1, t2, 'related', 'admin'),
  (t4, t1, 'related', 'john.operator'),
  (t12, t13, 'related', 'sarah.admin');

  RAISE NOTICE 'ITSM seed complete!';
END $$;
