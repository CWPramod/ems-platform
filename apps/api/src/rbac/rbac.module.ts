// RBAC Module
// Role-Based Access Control module
// apps/api/src/rbac/rbac.module.ts

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';
import { RbacGuard, AdminGuard, RbacAnyGuard } from './guards/rbac.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([])], // Will use raw queries
  providers: [RbacService, RbacGuard, AdminGuard, RbacAnyGuard],
  exports: [RbacService, RbacGuard, AdminGuard, RbacAnyGuard],
})
export class RbacModule {}
