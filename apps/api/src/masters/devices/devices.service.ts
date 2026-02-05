// Devices Service (Fixed)
// Enhanced device/asset management
// apps/api/src/masters/devices/devices.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset, AssetType } from '../../entities/asset.entity';
import { DeviceInterface } from '../../entities/device-interface.entity';

interface CreateDeviceDto {
  name: string;
  type: AssetType;
  ip: string;
  location: string;
  region?: string;
  vendor: string;
  model?: string;
  tags?: string[];
  tier: number;
  owner: string;
  department?: string;
  monitoringEnabled?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(DeviceInterface)
    private interfaceRepo: Repository<DeviceInterface>,
  ) {}

  /**
   * Create a new device
   */
  async create(createDeviceDto: CreateDeviceDto, userId: number): Promise<Asset> {
    // Check if device with same IP already exists
    const existing = await this.assetRepo.findOne({
      where: { ip: createDeviceDto.ip },
    });

    if (existing) {
      throw new BadRequestException('Device with this IP already exists');
    }

    const device = this.assetRepo.create({
      name: createDeviceDto.name,
      type: createDeviceDto.type,
      ip: createDeviceDto.ip,
      location: createDeviceDto.location,
      region: createDeviceDto.region,
      vendor: createDeviceDto.vendor,
      model: createDeviceDto.model,
      tags: createDeviceDto.tags || [],
      tier: createDeviceDto.tier,
      owner: createDeviceDto.owner,
      department: createDeviceDto.department,
      monitoringEnabled: createDeviceDto.monitoringEnabled !== false,
      metadata: createDeviceDto.metadata || {},
    });

    return this.assetRepo.save(device);
  }

  /**
   * Get all devices with filters
   */
  async findAll(filters?: {
    type?: string;
    location?: string;
    vendor?: string;
    tier?: number;
    monitoringEnabled?: boolean;
    search?: string;
  }): Promise<Asset[]> {
    const query = this.assetRepo.createQueryBuilder('a');

    if (filters?.type) {
      query.andWhere('a.type = :type', { type: filters.type });
    }

    if (filters?.location) {
      query.andWhere('a.location = :location', { location: filters.location });
    }

    if (filters?.vendor) {
      query.andWhere('a.vendor = :vendor', { vendor: filters.vendor });
    }

    if (filters?.tier) {
      query.andWhere('a.tier = :tier', { tier: filters.tier });
    }

    if (filters?.monitoringEnabled !== undefined) {
      query.andWhere('a.monitoringEnabled = :monitoring', {
        monitoring: filters.monitoringEnabled,
      });
    }

    if (filters?.search) {
      query.andWhere(
        '(a.name ILIKE :search OR a.ip ILIKE :search OR a.vendor ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    query.orderBy('a.name', 'ASC');

    return query.getMany();
  }

  /**
   * Get device by ID with interfaces
   */
  async findOne(id: string): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Get interfaces for this device
    const interfaces = await this.interfaceRepo.find({
      where: { assetId: id },
    });

    return {
      ...device,
      interfaces,
    };
  }

  /**
   * Update device
   */
  async update(
    id: string,
    updateDeviceDto: Partial<CreateDeviceDto>,
    userId: number
  ): Promise<Asset | null> {
    const device = await this.assetRepo.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // If updating IP, check for duplicates
    if (updateDeviceDto.ip && updateDeviceDto.ip !== device.ip) {
      const existing = await this.assetRepo.findOne({
        where: { ip: updateDeviceDto.ip },
      });

      if (existing) {
        throw new BadRequestException('Device with this IP already exists');
      }
    }

    // Build update object
    const updateData: any = {};
    if (updateDeviceDto.name) updateData.name = updateDeviceDto.name;
    if (updateDeviceDto.type) updateData.type = updateDeviceDto.type;
    if (updateDeviceDto.ip) updateData.ip = updateDeviceDto.ip;
    if (updateDeviceDto.location) updateData.location = updateDeviceDto.location;
    if (updateDeviceDto.region) updateData.region = updateDeviceDto.region;
    if (updateDeviceDto.vendor) updateData.vendor = updateDeviceDto.vendor;
    if (updateDeviceDto.model) updateData.model = updateDeviceDto.model;
    if (updateDeviceDto.tags) updateData.tags = updateDeviceDto.tags;
    if (updateDeviceDto.tier) updateData.tier = updateDeviceDto.tier;
    if (updateDeviceDto.owner) updateData.owner = updateDeviceDto.owner;
    if (updateDeviceDto.department) updateData.department = updateDeviceDto.department;
    if (updateDeviceDto.monitoringEnabled !== undefined) {
      updateData.monitoringEnabled = updateDeviceDto.monitoringEnabled;
    }
    if (updateDeviceDto.metadata) updateData.metadata = updateDeviceDto.metadata;

    await this.assetRepo.update(id, updateData);

    return this.assetRepo.findOne({ where: { id } });
  }

  /**
   * Delete device
   */
  async remove(id: string, userId: number): Promise<void> {
    const device = await this.assetRepo.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Delete associated interfaces first
    await this.interfaceRepo.delete({ assetId: id });

    // Delete device
    await this.assetRepo.delete(id);
  }

  /**
   * Get critical devices
   */
  async getCriticalDevices(): Promise<Asset[]> {
    return this.assetRepo.find({
      where: { tier: 1 },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find device by IP
   */
  async findByIpAddress(ipAddress: string): Promise<Asset | null> {
    return this.assetRepo.findOne({
      where: { ip: ipAddress },
    });
  }

  /**
   * Get devices by type
   */
  async getByType(type: string): Promise<Asset[]> {
    return this.assetRepo.find({
      where: { type: type as AssetType },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get device statistics
   */
  async getStatistics(): Promise<any> {
    const total = await this.assetRepo.count();
    const monitoring = await this.assetRepo.count({
      where: { monitoringEnabled: true },
    });
    const critical = await this.assetRepo.count({
      where: { tier: 1 },
    });
    const byStatus = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status')
      .getRawMany();

    return {
      total,
      monitoring,
      critical,
      byStatus,
    };
  }

  /**
   * Add interface to device
   */
  async addInterface(assetId: string, interfaceData: any): Promise<DeviceInterface> {
    const device = await this.assetRepo.findOne({ where: { id: assetId } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const interface_ = this.interfaceRepo.create({
  assetId,
  ...interfaceData,
});

const saved = await this.interfaceRepo.save(interface_);
return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Get interfaces for device
   */
  async getInterfaces(assetId: string): Promise<DeviceInterface[]> {
    return this.interfaceRepo.find({
      where: { assetId },
      order: { interfaceName: 'ASC' },
    });
  }

  /**
   * Update interface
   */
  async updateInterface(
    interfaceId: number,
    updateData: any
  ): Promise<DeviceInterface | null> {
    const interface_ = await this.interfaceRepo.findOne({
      where: { id: interfaceId },
    });

    if (!interface_) {
      throw new NotFoundException('Interface not found');
    }

    await this.interfaceRepo.update(interfaceId, updateData);

    return this.interfaceRepo.findOne({ where: { id: interfaceId } });
  }

  /**
   * Bulk create devices from parsed rows
   */
  async bulkCreate(
    devices: CreateDeviceDto[],
  ): Promise<{ created: number; errors: { row: number; error: string }[] }> {
    const errors: { row: number; error: string }[] = [];
    let created = 0;

    for (let i = 0; i < devices.length; i++) {
      try {
        const dto = devices[i];
        if (!dto.name || !dto.type || !dto.ip || !dto.location || !dto.vendor || !dto.owner) {
          errors.push({ row: i + 1, error: 'Missing required fields (name, type, ip, location, vendor, owner)' });
          continue;
        }

        const existing = await this.assetRepo.findOne({ where: { ip: dto.ip } });
        if (existing) {
          errors.push({ row: i + 1, error: `Device with IP ${dto.ip} already exists` });
          continue;
        }

        const device = this.assetRepo.create({
          name: dto.name,
          type: dto.type,
          ip: dto.ip,
          location: dto.location,
          region: dto.region,
          vendor: dto.vendor,
          model: dto.model,
          tags: dto.tags || [],
          tier: dto.tier || 3,
          owner: dto.owner,
          department: dto.department,
          monitoringEnabled: dto.monitoringEnabled !== false,
          metadata: dto.metadata || {},
        });

        await this.assetRepo.save(device);
        created++;
      } catch (err) {
        errors.push({ row: i + 1, error: err.message || 'Unknown error' });
      }
    }

    return { created, errors };
  }

  /**
   * Toggle monitoring for device
   */
  async toggleMonitoring(id: string, enabled: boolean): Promise<Asset | null> {
    const device = await this.assetRepo.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.assetRepo.update(id, { monitoringEnabled: enabled });

    return this.assetRepo.findOne({ where: { id } });
  }
}

export type { CreateDeviceDto };
