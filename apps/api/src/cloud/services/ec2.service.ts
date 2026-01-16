import { Injectable, Logger } from '@nestjs/common';
import { EC2Client, DescribeInstancesCommand, Instance } from '@aws-sdk/client-ec2';
import { CloudConfig } from '../cloud.config';

@Injectable()
export class EC2Service {
  private readonly logger = new Logger(EC2Service.name);
  private ec2Client: EC2Client;

  constructor() {
    // Initialize EC2 client - will use environment credentials or IAM role
    const config: any = {
      region: CloudConfig.aws.region,
    };
    
    if (CloudConfig.aws.credentials) {
      config.credentials = CloudConfig.aws.credentials;
    }
    
    this.ec2Client = new EC2Client(config);
  }

  /**
   * Discover all EC2 instances in the AWS account
   */
  async discoverInstances(): Promise<any[]> {
    try {
      this.logger.log('Starting EC2 instance discovery...');

      const command = new DescribeInstancesCommand({});
      const response = await this.ec2Client.send(command);

      const instances: any[] = [];

      // Parse reservations and instances
      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const parsedInstance = this.parseInstance(instance);
          instances.push(parsedInstance);
        }
      }

      this.logger.log(`Discovered ${instances.length} EC2 instances`);
      return instances;
    } catch (error) {
      this.logger.error('Failed to discover EC2 instances', error.stack);
      
      // Return mock data for demo if AWS credentials not configured
      return this.getMockEC2Instances();
    }
  }

  /**
   * Parse EC2 instance into our asset format
   */
  private parseInstance(instance: Instance): any {
    const nameTag = instance.Tags?.find((tag) => tag.Key === 'Name');
    const name = nameTag?.Value || instance.InstanceId || 'Unknown';

    return {
      name,
      type: 'server',
      ip: instance.PrivateIpAddress || instance.PublicIpAddress,
      location: `AWS ${instance.Placement?.AvailabilityZone || 'Unknown'}`,
      region: instance.Placement?.AvailabilityZone?.slice(0, -1), // Remove last char (zone letter)
      vendor: 'AWS',
      model: instance.InstanceType || 'Unknown',
      tier: this.determineTier(instance),
      status: this.mapInstanceState(instance.State?.Name),
      monitoringEnabled: true,
      metadata: {
        instanceId: instance.InstanceId,
        instanceType: instance.InstanceType,
        launchTime: instance.LaunchTime,
        subnetId: instance.SubnetId,
        vpcId: instance.VpcId,
        platform: instance.Platform || 'linux',
        publicIp: instance.PublicIpAddress,
        privateIp: instance.PrivateIpAddress,
      },
      tags: instance.Tags?.map((tag) => `${tag.Key}:${tag.Value}`) || [],
      owner: 'cloud-team',
    };
  }

  /**
   * Determine tier based on instance type
   */
  private determineTier(instance: Instance): number {
    const instanceType = instance.InstanceType || '';
    
    // Large instances are tier 1
    if (instanceType.includes('xlarge') || instanceType.includes('metal')) {
      return 1;
    }
    
    // Medium instances are tier 2
    if (instanceType.includes('large') || instanceType.includes('medium')) {
      return 2;
    }
    
    // Small instances are tier 3
    return 3;
  }

  /**
   * Map AWS instance state to our status
   */
  private mapInstanceState(state?: string): string {
    switch (state) {
      case 'running':
        return 'online';
      case 'stopped':
      case 'stopping':
      case 'terminated':
      case 'terminating':
        return 'offline';
      case 'pending':
      case 'shutting-down':
        return 'maintenance';
      default:
        return 'offline';
    }
  }

  /**
   * Get mock EC2 instances for demo (when AWS not configured)
   */
  private getMockEC2Instances(): any[] {
    return [
      {
        name: 'Web-Server-Prod-01',
        type: 'server',
        ip: '10.0.1.100',
        location: 'AWS us-east-1a',
        region: 'us-east-1',
        vendor: 'AWS',
        model: 't3.large',
        tier: 2,
        status: 'online',
        monitoringEnabled: true,
        metadata: {
          instanceId: 'i-1234567890abcdef0',
          instanceType: 't3.large',
          platform: 'linux',
          publicIp: '54.123.45.67',
          privateIp: '10.0.1.100',
        },
        tags: ['Environment:Production', 'Application:WebServer'],
        owner: 'cloud-team',
      },
      {
        name: 'API-Server-Prod-01',
        type: 'server',
        ip: '10.0.1.101',
        location: 'AWS us-east-1b',
        region: 'us-east-1',
        vendor: 'AWS',
        model: 't3.xlarge',
        tier: 1,
        status: 'online',
        monitoringEnabled: true,
        metadata: {
          instanceId: 'i-1234567890abcdef1',
          instanceType: 't3.xlarge',
          platform: 'linux',
          publicIp: '54.123.45.68',
          privateIp: '10.0.1.101',
        },
        tags: ['Environment:Production', 'Application:API'],
        owner: 'cloud-team',
      },
      {
        name: 'Worker-Node-01',
        type: 'server',
        ip: '10.0.2.50',
        location: 'AWS us-east-1c',
        region: 'us-east-1',
        vendor: 'AWS',
        model: 't3.medium',
        tier: 3,
        status: 'online',
        monitoringEnabled: true,
        metadata: {
          instanceId: 'i-1234567890abcdef2',
          instanceType: 't3.medium',
          platform: 'linux',
          privateIp: '10.0.2.50',
        },
        tags: ['Environment:Production', 'Application:Worker'],
        owner: 'cloud-team',
      },
    ];
  }
}