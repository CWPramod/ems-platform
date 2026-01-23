// Device Service
// Handles device/asset management with enhanced NMS fields
// apps/api/src/masters/devices/devices.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface Device {
  id: number;
  name: string;
  asset_type: string;
  customer_id?: number;
  location_id?: number;
  device_oem?: string;
  device_model?: string;
  device_serial?: string;
  ip_address?: string;
  secondary_ip?: string;
  mac_address?: string;
  hostname?: string;
  is_critical: boolean;
  criticality_level: string;
  monitoring_protocol?: string;
  credentials_id?: number;
  device_category?: string;
  os_type?: string;
  os_version?: string;
  firmware_version?: string;
  polling_interval: number;
  is_monitored: boolean;
  monitoring_status: string;
  rack_location?: string;
  physical_location?: string;
  warranty_expiry?: Date;
  purchase_date?: Date;
  notes?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface DeviceInterface {
  id: number;
  asset_id: number;
  interface_name: string;
  interface_alias?: string;
  interface_index?: number;
  interface_type?: string;
  ip_address?: string;
  subnet_mask?: string;
  mac_address?: string;
  vlan_id?: number;
  speed_mbps?: number;
  duplex?: string;
  mtu?: number;
  admin_status: string;
  operational_status: string;
  is_monitored: boolean;
  monitor_bandwidth: boolean;
  monitor_errors: boolean;
  description?: string;
  last_seen?: Date;
}

interface CreateDeviceDto {
  name: string;
  asset_type: string;
  customer_id?: number;
  location_id?: number;
  device_oem?: string;
  device_model?: string;
  device_serial?: string;
  ip_address?: string;
  secondary_ip?: string;
  mac_address?: string;
  hostname?: string;
  is_critical?: boolean;
  criticality_level?: string;
  monitoring_protocol?: string;
  credentials_id?: number;
  device_category?: string;
  os_type?: string;
  os_version?: string;
  firmware_version?: string;
  polling_interval?: number;
  is_monitored?: boolean;
  rack_location?: string;
  physical_location?: string;
  warranty_expiry?: Date;
  purchase_date?: Date;
  notes?: string;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository('Asset')
    private assetRepo: Repository<Device>,
    @InjectRepository('DeviceInterface')
    private interfaceRepo: Repository<DeviceInterface>,
  ) {}

  /**
   * Create a new device
   */
  async create(createDeviceDto: CreateDeviceDto, userId: number): Promise<Device> {
    // Check if IP address already exists
    if (createDeviceDto.ip_address) {
      const existing = await this.assetRepo.findOne({
        where: { ip_address: createDeviceDto.ip_address },
      });

      if (existing) {
        throw new BadRequestException('Device with this IP address already exists');
      }
    }

    const device = await this.assetRepo.save({
      ...createDeviceDto,
      criticality_level: createDeviceDto.criticality_level || 'normal',
      polling_interval: createDeviceDto.polling_interval || 300,
      is_monitored: createDeviceDto.is_monitored !== false,
      monitoring_status: 'active',
      status: 'pending', // Will be updated by monitoring
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return device;
  }

  /**
   * Get all devices with filters
   */
  async findAll(filters?: {
    customer_id?: number;
    location_id?: number;
    device_category?: string;
    is_critical?: boolean;
    monitoring_status?: string;
    status?: string;
    search?: string;
  }): Promise<Device[]> {
    const query = this.assetRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.customer', 'c')
      .leftJoinAndSelect('a.location', 'l');

    if (filters?.customer_id) {
      query.andWhere('a.customer_id = :customerId', { customerId: filters.customer_id });
    }

    if (filters?.location_id) {
      query.andWhere('a.location_id = :locationId', { locationId: filters.location_id });
    }

    if (filters?.device_category) {
      query.andWhere('a.device_category = :category', { category: filters.device_category });
    }

    if (filters?.is_critical !== undefined) {
      query.andWhere('a.is_critical = :critical', { critical: filters.is_critical });
    }

    if (filters?.monitoring_status) {
      query.andWhere('a.monitoring_status = :status', { status: filters.monitoring_status });
    }

    if (filters?.status) {
      query.andWhere('a.status = :deviceStatus', { deviceStatus: filters.status });
    }

    if (filters?.search) {
      query.andWhere(
        '(a.name ILIKE :search OR a.ip_address::TEXT ILIKE :search OR a.hostname ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    query.orderBy('a.is_critical', 'DESC')
         .addOrderBy('a.name', 'ASC');

    return query.getMany();
  }

  /**
   * Get device by ID with full details
   */
  async findOne(id: number): Promise<any> {
    const device = await this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.customer', 'c')
      .leftJoinAndSelect('a.location', 'l')
      .leftJoinAndSelect('a.credentials', 'cr')
      .where('a.id = :id', { id })
      .getOne();

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Get interfaces
    const interfaces = await this.interfaceRepo.find({
      where: { asset_id: id },
      order: { interface_name: 'ASC' },
    });

    return {
      ...device,
      interfaces,
      interface_count: interfaces.length,
      interfaces_up: interfaces.filter(i => i.operational_status === 'up').length,
      interfaces_down: interfaces.filter(i => i.operational_status === 'down').length,
    };
  }

  /**
   * Update device
   */
  async update(
    id: number,
    updateDeviceDto: Partial<CreateDeviceDto>,
    userId: number
  ): Promise<Device> {
    const device = await this.assetRepo.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check IP uniqueness if changing
    if (updateDeviceDto.ip_address && updateDeviceDto.ip_address !== device.ip_address) {
      const existing = await this.assetRepo.findOne({
        where: { ip_address: updateDeviceDto.ip_address },
      });

      if (existing) {
        throw new BadRequestException('Device with this IP address already exists');
      }
    }

    await this.assetRepo.update(id, {
      ...updateDeviceDto,
      updated_by: userId,
      updated_at: new Date(),
    });

    return this.assetRepo.findOne({ where: { id } });
  }

  /**
   * Delete device
   */
  async remove(id: number, userId: number): Promise<void> {
    const device = await this.assetRepo.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Soft delete by disabling monitoring
    await this.assetRepo.update(id, {
      is_monitored: false,
      monitoring_status: 'disabled',
      updated_by: userId,
      updated_at: new Date(),
    });
  }

  /**
   * Get critical devices
   */
  async getCriticalDevices(): Promise<Device[]> {
    return this.assetRepo.find({
      where: {
        is_critical: true,
        is_monitored: true,
      },
      relations: ['customer', 'location'],
      order: {
        status: 'DESC',
        name: 'ASC',
      },
    });
  }

  /**
   * Get device by IP address
   */
  async findByIpAddress(ipAddress: string): Promise<Device> {
    const device = await this.assetRepo.findOne({
      where: { ip_address: ipAddress },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }

  /**
   * Get devices by category
   */
  async getByCategory(category: string): Promise<Device[]> {
    return this.assetRepo.find({
      where: { device_category: category },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get device statistics
   */
  async getStatistics(): Promise<any> {
    const total = await this.assetRepo.count({ where: { is_monitored: true } });
    const critical = await this.assetRepo.count({
      where: { is_critical: true, is_monitored: true },
    });
    const up = await this.assetRepo.count({
      where: { status: 'up', is_monitored: true },
    });
    const down = await this.assetRepo.count({
      where: { status: 'down', is_monitored: true },
    });
    const warning = await this.assetRepo.count({
      where: { status: 'warning', is_monitored: true },
    });

    // Get by category
    const categories = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.device_category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('a.is_monitored = true')
      .groupBy('a.device_category')
      .getRawMany();

    return {
      total,
      critical,
      up,
      down,
      warning,
      by_category: categories,
    };
  }

  /**
   * Add interface to device
   */
  async addInterface(deviceId: number, interfaceData: Partial<DeviceInterface>): Promise<DeviceInterface> {
    const device = await this.assetRepo.findOne({ where: { id: deviceId } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if interface already exists
    const existing = await this.interfaceRepo.findOne({
      where: {
        asset_id: deviceId,
        interface_name: interfaceData.interface_name,
      },
    });

    if (existing) {
      throw new BadRequestException('Interface already exists for this device');
    }

    const deviceInterface = await this.interfaceRepo.save({
      asset_id: deviceId,
      ...interfaceData,
      admin_status: interfaceData.admin_status || 'up',
      operational_status: interfaceData.operational_status || 'down',
      is_monitored: interfaceData.is_monitored !== false,
      monitor_bandwidth: interfaceData.monitor_bandwidth !== false,
      monitor_errors: interfaceData.monitor_errors !== false,
      created_at: new Date(),
    });

    return deviceInterface;
  }

  /**
   * Get device interfaces
   */
  async getInterfaces(deviceId: number): Promise<DeviceInterface[]> {
    return this.interfaceRepo.find({
      where: { asset_id: deviceId },
      order: { interface_name: 'ASC' },
    });
  }

  /**
   * Update interface
   */
  async updateInterface(
    interfaceId: number,
    updateData: Partial<DeviceInterface>
  ): Promise<DeviceInterface> {
    const deviceInterface = await this.interfaceRepo.findOne({
      where: { id: interfaceId },
    });

    if (!deviceInterface) {
      throw new NotFoundException('Interface not found');
    }

    await this.interfaceRepo.update(interfaceId, {
      ...updateData,
      updated_at: new Date(),
    });

    return this.interfaceRepo.findOne({ where: { id: interfaceId } });
  }

  /**
   * Import devices from CSV/Excel
   */
  async importDevices(devices: CreateDeviceDto[], userId: number): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const deviceDto of devices) {
      try {
        await this.create(deviceDto, userId);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Failed to import ${deviceDto.name}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Toggle monitoring for device
   */
  async toggleMonitoring(id: number, enabled: boolean): Promise<Device> {
    const device = await this.assetRepo.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.assetRepo.update(id, {
      is_monitored: enabled,
      monitoring_status: enabled ? 'active' : 'paused',
      updated_at: new Date(),
    });

    return this.assetRepo.findOne({ where: { id } });
  }

  /**
   * Update device status (called by monitoring service)
   */
  async updateStatus(id: number, status: string): Promise<void> {
    await this.assetRepo.update(id, {
      status,
      updated_at: new Date(),
    });
  }
}

export { Device, DeviceInterface, CreateDeviceDto };
