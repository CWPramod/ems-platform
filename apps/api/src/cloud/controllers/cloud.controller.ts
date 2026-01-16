import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { EC2Service } from '../services/ec2.service';
import { RDSService } from '../services/rds.service';
import { CloudWatchService } from '../services/cloudwatch.service';

@Controller('cloud')
export class CloudController {
  private readonly logger = new Logger(CloudController.name);

  constructor(
    private readonly ec2Service: EC2Service,
    private readonly rdsService: RDSService,
    private readonly cloudWatchService: CloudWatchService,
  ) {}

  /**
   * GET /cloud/discover/ec2
   * Discover all EC2 instances
   */
  @Get('discover/ec2')
  async discoverEC2() {
    this.logger.log('EC2 discovery requested');
    const instances = await this.ec2Service.discoverInstances();
    return {
      count: instances.length,
      instances,
    };
  }

  /**
   * GET /cloud/discover/rds
   * Discover all RDS databases
   */
  @Get('discover/rds')
  async discoverRDS() {
    this.logger.log('RDS discovery requested');
    const databases = await this.rdsService.discoverDatabases();
    return {
      count: databases.length,
      databases,
    };
  }

  /**
   * GET /cloud/discover/all
   * Discover all cloud resources
   */
  @Get('discover/all')
  async discoverAll() {
    this.logger.log('Full cloud discovery requested');
    
    const [ec2Instances, rdsDatabases] = await Promise.all([
      this.ec2Service.discoverInstances(),
      this.rdsService.discoverDatabases(),
    ]);

    return {
      summary: {
        totalResources: ec2Instances.length + rdsDatabases.length,
        ec2Count: ec2Instances.length,
        rdsCount: rdsDatabases.length,
      },
      resources: {
        ec2: ec2Instances,
        rds: rdsDatabases,
      },
    };
  }

  /**
   * GET /cloud/metrics/ec2/:instanceId
   * Get CloudWatch metrics for an EC2 instance
   */
  @Get('metrics/ec2')
  async getEC2Metrics(
    @Query('instanceId') instanceId: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    
    this.logger.log(`EC2 metrics requested for ${instanceId} (${hoursNum}h)`);

    const [cpuMetrics, networkMetrics] = await Promise.all([
      this.cloudWatchService.getEC2CPUMetrics(instanceId, hoursNum),
      this.cloudWatchService.getEC2NetworkMetrics(instanceId, hoursNum),
    ]);

    return {
      instanceId,
      timeRange: `${hoursNum} hours`,
      metrics: {
        cpu: cpuMetrics,
        network: networkMetrics,
      },
    };
  }

  /**
   * GET /cloud/metrics/rds/:dbInstanceId
   * Get CloudWatch metrics for an RDS instance
   */
  @Get('metrics/rds')
  async getRDSMetrics(
    @Query('dbInstanceId') dbInstanceId: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    
    this.logger.log(`RDS metrics requested for ${dbInstanceId} (${hoursNum}h)`);

    const [cpuMetrics, connectionMetrics] = await Promise.all([
      this.cloudWatchService.getRDSCPUMetrics(dbInstanceId, hoursNum),
      this.cloudWatchService.getRDSConnectionMetrics(dbInstanceId, hoursNum),
    ]);

    return {
      dbInstanceId,
      timeRange: `${hoursNum} hours`,
      metrics: {
        cpu: cpuMetrics,
        connections: connectionMetrics,
      },
    };
  }

  /**
   * POST /cloud/import/ec2
   * Import discovered EC2 instances as assets
   */
  @Post('import/ec2')
  async importEC2Assets(@Body() body: { instanceIds?: string[] }) {
    this.logger.log('EC2 import requested');
    
    const instances = await this.ec2Service.discoverInstances();
    
    // Filter by instanceIds if provided
    const instancesToImport = body.instanceIds && body.instanceIds.length > 0
      ? instances.filter((i) => body.instanceIds!.includes(i.metadata.instanceId))
      : instances;

    return {
      imported: instancesToImport.length,
      assets: instancesToImport,
      message: `Ready to import ${instancesToImport.length} EC2 instances as assets`,
    };
  }

  /**
   * POST /cloud/import/rds
   * Import discovered RDS instances as assets
   */
  @Post('import/rds')
  async importRDSAssets(@Body() body: { dbInstanceIds?: string[] }) {
    this.logger.log('RDS import requested');
    
    const databases = await this.rdsService.discoverDatabases();
    
    // Filter by dbInstanceIds if provided
    const databasesToImport = body.dbInstanceIds && body.dbInstanceIds.length > 0
      ? databases.filter((d) => body.dbInstanceIds!.includes(d.metadata.dbInstanceId))
      : databases;

    return {
      imported: databasesToImport.length,
      assets: databasesToImport,
      message: `Ready to import ${databasesToImport.length} RDS instances as assets`,
    };
  }

  /**
   * GET /cloud/status
   * Get cloud monitoring status
   */
  @Get('status')
  async getStatus() {
    return {
      service: 'Cloud Monitoring',
      status: 'operational',
      region: process.env.AWS_REGION || 'us-east-1',
      features: {
        ec2Discovery: true,
        rdsDiscovery: true,
        cloudWatchMetrics: true,
      },
      credentialsConfigured: !!(
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ),
    };
  }
}