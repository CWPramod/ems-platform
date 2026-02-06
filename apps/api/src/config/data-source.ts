/**
 * TypeORM Data Source Configuration
 * Used for migrations and CLI operations
 * Usage:
 *   npm run migration:generate -- -n MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  username: process.env.DATABASE_USER || 'ems_admin',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'ems_platform',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // NEVER use synchronize in production
  logging: process.env.NODE_ENV !== 'production',
  migrationsTableName: 'typeorm_migrations',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
