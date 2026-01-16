import { Module } from '@nestjs/common';
import { EC2Service } from './services/ec2.service';
import { RDSService } from './services/rds.service';
import { CloudWatchService } from './services/cloudwatch.service';
import { CloudController } from './controllers/cloud.controller';

@Module({
  providers: [EC2Service, RDSService, CloudWatchService],
  controllers: [CloudController],
  exports: [EC2Service, RDSService, CloudWatchService],
})
export class CloudModule {}