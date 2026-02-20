import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SlaPolicy } from '../../sla/entities/sla-policy.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'ems_admin',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'ems_platform',
  entities: [SlaPolicy],
  synchronize: false,
});

const defaultPolicies = [
  {
    name: 'Critical SLA',
    severity: 'critical',
    responseTimeMinutes: 15,
    resolutionTimeMinutes: 60,
    escalationLevel1Minutes: 30,
    escalationLevel2Minutes: 45,
    isDefault: true,
  },
  {
    name: 'High SLA',
    severity: 'high',
    responseTimeMinutes: 30,
    resolutionTimeMinutes: 240,
    escalationLevel1Minutes: 120,
    escalationLevel2Minutes: 180,
    isDefault: true,
  },
  {
    name: 'Medium SLA',
    severity: 'medium',
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 480,
    escalationLevel1Minutes: 360,
    escalationLevel2Minutes: 420,
    isDefault: true,
  },
  {
    name: 'Low SLA',
    severity: 'low',
    responseTimeMinutes: 240,
    resolutionTimeMinutes: 1440,
    escalationLevel1Minutes: 720,
    escalationLevel2Minutes: 1200,
    isDefault: true,
  },
];

async function seed() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(SlaPolicy);

  for (const policy of defaultPolicies) {
    const exists = await repo.findOne({
      where: { severity: policy.severity, isDefault: true },
    });
    if (!exists) {
      await repo.save(repo.create(policy));
      console.log(`Seeded SLA policy: ${policy.name}`);
    } else {
      console.log(`SLA policy already exists: ${policy.name}`);
    }
  }

  await dataSource.destroy();
  console.log('SLA policies seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
