import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../entities/asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private assetsRepository: Repository<Asset>,
  ) {}

  // Create new asset
  async create(assetData: Partial<Asset>): Promise<Asset> {
    const asset = this.assetsRepository.create(assetData);
    return await this.assetsRepository.save(asset);
  }

  // Get all assets with optional filtering
  async findAll(filters?: {
    type?: string;
    status?: string;
    tier?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Asset[]; total: number }> {
    const queryBuilder = this.assetsRepository.createQueryBuilder('asset');

    // Apply filters
    if (filters?.type) {
      queryBuilder.andWhere('asset.type = :type', { type: filters.type });
    }
    if (filters?.status) {
      queryBuilder.andWhere('asset.status = :status', { status: filters.status });
    }
    if (filters?.tier) {
      queryBuilder.andWhere('asset.tier = :tier', { tier: filters.tier });
    }

    // Pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    queryBuilder.take(limit).skip(offset);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  // Get single asset by ID
  async findOne(id: string): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({ where: { id } });
    
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    
    return asset;
  }

  // Update asset
  async update(id: string, updateData: Partial<Asset>): Promise<Asset> {
    const asset = await this.findOne(id);
    Object.assign(asset, updateData);
    return await this.assetsRepository.save(asset);
  }

  // Delete asset
  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.assetsRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    
    return { success: true };
  }

  // Bulk import assets
  async bulkCreate(assetsData: Partial<Asset>[]): Promise<{ created: number; failed: number }> {
    let created = 0;
    let failed = 0;

    for (const assetData of assetsData) {
      try {
        await this.create(assetData);
        created++;
      } catch (error) {
        failed++;
      }
    }

    return { created, failed };
  }
}