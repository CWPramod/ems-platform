import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { Asset } from '../entities/asset.entity';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() assetData: Partial<Asset>): Promise<Asset> {
    return await this.assetsService.create(assetData);
  }

  @Get()
  async findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: Asset[]; total: number; page: number }> {
    const filters = {
      type,
      status,
      tier: tier ? parseInt(tier, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    const result = await this.assetsService.findAll(filters);

    return {
      ...result,
      page: Math.floor((filters.offset || 0) / (filters.limit || 50)),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Asset> {
    return await this.assetsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<Asset>,
  ): Promise<Asset> {
    return await this.assetsService.update(id, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return await this.assetsService.remove(id);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreate(
    @Body('assets') assetsData: Partial<Asset>[],
  ): Promise<{ created: number; failed: number; errors?: string[] }> {
    const result = await this.assetsService.bulkCreate(assetsData);
    return result;
  }
}