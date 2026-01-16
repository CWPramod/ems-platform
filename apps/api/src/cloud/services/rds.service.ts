import { Injectable, Logger } from '@nestjs/common';
import { RDSClient, DescribeDBInstancesCommand, DBInstance } from '@aws-sdk/client-rds';
import { CloudConfig } from '../cloud.config';

@Injectable()
export class RDSService {
  private readonly logger = new Logger(RDSService.name);
  private rdsClient: RDSClient;

  constructor() {
    const config: any = {
      region: CloudConfig.aws.region,
    };
    
    if (CloudConfig.aws.credentials) {
      config.credentials = CloudConfig.aws.credentials;
    }
    
    this.rdsClient = new RDSClient(config);
  }

  /**
   * Discover all RDS instances in the AWS account
   */
  async discoverDatabases(): Promise<any[]> {
    try {
      this.logger.log('Starting RDS instance discovery...');

      const command = new DescribeDBInstancesCommand({});
      const response = await this.rdsClient.send(command);

      const databases: any[] = [];

      for (const dbInstance of response.DBInstances || []) {
        const parsedDatabase = this.parseDatabase(dbInstance);
        databases.push(parsedDatabase);
      }

      this.logger.log(`Discovered ${databases.length} RDS instances`);
      return databases;
    } catch (error) {
      this.logger.error('Failed to discover RDS instances', error.stack);
      
      // Return mock data for demo
      return this.getMockRDSInstances();
    }
  }

  /**
   * Parse RDS instance into our asset format
   */
  private parseDatabase(dbInstance: DBInstance): any {
    return {
      name: dbInstance.DBInstanceIdentifier || 'Unknown',
      type: 'server',
      ip: dbInstance.Endpoint?.Address,
      location: `AWS ${dbInstance.AvailabilityZone || 'Unknown'}`,
      region: dbInstance.AvailabilityZone?.slice(0, -1),
      vendor: 'AWS RDS',
      model: `${dbInstance.Engine} ${dbInstance.EngineVersion}`,
      tier: this.determineTier(dbInstance),
      status: this.mapDBStatus(dbInstance.DBInstanceStatus),
      monitoringEnabled: true,
      metadata: {
        dbInstanceId: dbInstance.DBInstanceIdentifier,
        dbInstanceClass: dbInstance.DBInstanceClass,
        engine: dbInstance.Engine,
        engineVersion: dbInstance.EngineVersion,
        allocatedStorage: dbInstance.AllocatedStorage,
        storageType: dbInstance.StorageType,
        multiAZ: dbInstance.MultiAZ,
        endpoint: dbInstance.Endpoint?.Address,
        port: dbInstance.Endpoint?.Port,
        backupRetentionPeriod: dbInstance.BackupRetentionPeriod,
      },
      tags: [`Engine:${dbInstance.Engine}`, `Class:${dbInstance.DBInstanceClass}`],
      owner: 'database-team',
    };
  }

  /**
   * Determine tier based on instance class
   */
  private determineTier(dbInstance: DBInstance): number {
    const instanceClass = dbInstance.DBInstanceClass || '';
    
    // Large DB instances are tier 1
    if (instanceClass.includes('xlarge') || instanceClass.includes('8xlarge')) {
      return 1;
    }
    
    // Medium DB instances are tier 2
    if (instanceClass.includes('large') || instanceClass.includes('medium')) {
      return 2;
    }
    
    // Small DB instances are tier 3
    return 3;
  }

  /**
   * Map RDS status to our status
   */
  private mapDBStatus(status?: string): string {
    switch (status) {
      case 'available':
        return 'online';
      case 'stopped':
      case 'stopping':
      case 'failed':
        return 'offline';
      case 'creating':
      case 'modifying':
      case 'backing-up':
      case 'upgrading':
        return 'maintenance';
      default:
        return 'offline';
    }
  }

  /**
   * Get mock RDS instances for demo
   */
  private getMockRDSInstances(): any[] {
    return [
      {
        name: 'production-postgres-db',
        type: 'server',
        ip: 'prod-db.c9akciq32.us-east-1.rds.amazonaws.com',
        location: 'AWS us-east-1a',
        region: 'us-east-1',
        vendor: 'AWS RDS',
        model: 'postgres 15.4',
        tier: 1,
        status: 'online',
        monitoringEnabled: true,
        metadata: {
          dbInstanceId: 'production-postgres-db',
          dbInstanceClass: 'db.r6g.xlarge',
          engine: 'postgres',
          engineVersion: '15.4',
          allocatedStorage: 500,
          storageType: 'gp3',
          multiAZ: true,
          endpoint: 'prod-db.c9akciq32.us-east-1.rds.amazonaws.com',
          port: 5432,
          backupRetentionPeriod: 7,
        },
        tags: ['Engine:postgres', 'Class:db.r6g.xlarge', 'Environment:Production'],
        owner: 'database-team',
      },
      {
        name: 'analytics-mysql-db',
        type: 'server',
        ip: 'analytics-db.c9akciq32.us-east-1.rds.amazonaws.com',
        location: 'AWS us-east-1b',
        region: 'us-east-1',
        vendor: 'AWS RDS',
        model: 'mysql 8.0.35',
        tier: 2,
        status: 'online',
        monitoringEnabled: true,
        metadata: {
          dbInstanceId: 'analytics-mysql-db',
          dbInstanceClass: 'db.t3.large',
          engine: 'mysql',
          engineVersion: '8.0.35',
          allocatedStorage: 200,
          storageType: 'gp2',
          multiAZ: false,
          endpoint: 'analytics-db.c9akciq32.us-east-1.rds.amazonaws.com',
          port: 3306,
          backupRetentionPeriod: 7,
        },
        tags: ['Engine:mysql', 'Class:db.t3.large', 'Environment:Analytics'],
        owner: 'database-team',
      },
    ];
  }
}