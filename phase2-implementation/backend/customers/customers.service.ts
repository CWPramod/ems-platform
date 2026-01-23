// Customer Service
// Handles customer master CRUD operations and hierarchy management
// apps/api/src/masters/customers/customers.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
  customer_type: string;
  parent_customer_id?: number;
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  industry?: string;
  company_size?: string;
  tax_id?: string;
  is_active: boolean;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface CustomerLocation {
  id: number;
  customer_id: number;
  location_code: string;
  location_name: string;
  location_type: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  contact_person?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  notes?: string;
  created_at: Date;
}

interface CreateCustomerDto {
  customer_code: string;
  customer_name: string;
  customer_type?: string;
  parent_customer_id?: number;
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  industry?: string;
  company_size?: string;
  tax_id?: string;
  notes?: string;
}

interface CreateLocationDto {
  location_code: string;
  location_name: string;
  location_type?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  contact_person?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository('Customer')
    private customerRepo: Repository<Customer>,
    @InjectRepository('CustomerLocation')
    private locationRepo: Repository<CustomerLocation>,
  ) {}

  /**
   * Create a new customer
   */
  async create(createCustomerDto: CreateCustomerDto, userId: number): Promise<Customer> {
    // Check if customer code already exists
    const existing = await this.customerRepo.findOne({
      where: { customer_code: createCustomerDto.customer_code },
    });

    if (existing) {
      throw new BadRequestException('Customer code already exists');
    }

    // If parent_customer_id is provided, validate it exists
    if (createCustomerDto.parent_customer_id) {
      const parent = await this.customerRepo.findOne({
        where: { id: createCustomerDto.parent_customer_id },
      });

      if (!parent) {
        throw new NotFoundException('Parent customer not found');
      }
    }

    const customer = await this.customerRepo.save({
      ...createCustomerDto,
      customer_type: createCustomerDto.customer_type || 'Branch',
      country: createCustomerDto.country || 'India',
      is_active: true,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return customer;
  }

  /**
   * Get all customers with optional filters
   */
  async findAll(filters?: {
    customer_type?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<Customer[]> {
    const query = this.customerRepo.createQueryBuilder('c');

    if (filters?.customer_type) {
      query.andWhere('c.customer_type = :type', { type: filters.customer_type });
    }

    if (filters?.is_active !== undefined) {
      query.andWhere('c.is_active = :active', { active: filters.is_active });
    }

    if (filters?.search) {
      query.andWhere(
        '(c.customer_name ILIKE :search OR c.customer_code ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    query.orderBy('c.customer_name', 'ASC');

    return query.getMany();
  }

  /**
   * Get customer by ID
   */
  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  /**
   * Update customer
   */
  async update(
    id: number,
    updateCustomerDto: Partial<CreateCustomerDto>,
    userId: number
  ): Promise<Customer> {
    const customer = await this.findOne(id);

    // If updating customer_code, check for duplicates
    if (updateCustomerDto.customer_code && updateCustomerDto.customer_code !== customer.customer_code) {
      const existing = await this.customerRepo.findOne({
        where: { customer_code: updateCustomerDto.customer_code },
      });

      if (existing) {
        throw new BadRequestException('Customer code already exists');
      }
    }

    // If updating parent, validate it exists and prevent circular reference
    if (updateCustomerDto.parent_customer_id) {
      if (updateCustomerDto.parent_customer_id === id) {
        throw new BadRequestException('Customer cannot be its own parent');
      }

      const parent = await this.customerRepo.findOne({
        where: { id: updateCustomerDto.parent_customer_id },
      });

      if (!parent) {
        throw new NotFoundException('Parent customer not found');
      }
    }

    await this.customerRepo.update(id, {
      ...updateCustomerDto,
      updated_by: userId,
      updated_at: new Date(),
    });

    return this.findOne(id);
  }

  /**
   * Delete customer (soft delete by marking inactive)
   */
  async remove(id: number, userId: number): Promise<void> {
    const customer = await this.findOne(id);

    // Check if customer has children
    const childCount = await this.customerRepo.count({
      where: { parent_customer_id: id },
    });

    if (childCount > 0) {
      throw new BadRequestException('Cannot delete customer with child branches');
    }

    // Soft delete
    await this.customerRepo.update(id, {
      is_active: false,
      updated_by: userId,
      updated_at: new Date(),
    });
  }

  /**
   * Get customer hierarchy (tree structure)
   */
  async getHierarchy(customerId: number): Promise<any> {
    const result = await this.customerRepo.query(
      'SELECT * FROM get_customer_hierarchy($1)',
      [customerId]
    );

    return this.buildHierarchyTree(result);
  }

  /**
   * Get all HO customers (top-level)
   */
  async getHeadOffices(): Promise<Customer[]> {
    return this.customerRepo.find({
      where: {
        customer_type: 'HO',
        is_active: true,
      },
      order: {
        customer_name: 'ASC',
      },
    });
  }

  /**
   * Get branches for a customer
   */
  async getBranches(parentId: number): Promise<Customer[]> {
    return this.customerRepo.find({
      where: {
        parent_customer_id: parentId,
        is_active: true,
      },
      order: {
        customer_name: 'ASC',
      },
    });
  }

  /**
   * Create location for customer
   */
  async createLocation(
    customerId: number,
    createLocationDto: CreateLocationDto
  ): Promise<CustomerLocation> {
    const customer = await this.findOne(customerId);

    // Check if location code already exists for this customer
    const existing = await this.locationRepo.findOne({
      where: {
        customer_id: customerId,
        location_code: createLocationDto.location_code,
      },
    });

    if (existing) {
      throw new BadRequestException('Location code already exists for this customer');
    }

    const location = await this.locationRepo.save({
      customer_id: customerId,
      ...createLocationDto,
      location_type: createLocationDto.location_type || 'Branch',
      country: createLocationDto.country || 'India',
      is_active: true,
      created_at: new Date(),
    });

    return location;
  }

  /**
   * Get locations for customer
   */
  async getLocations(customerId: number): Promise<CustomerLocation[]> {
    return this.locationRepo.find({
      where: {
        customer_id: customerId,
        is_active: true,
      },
      order: {
        location_name: 'ASC',
      },
    });
  }

  /**
   * Get all locations for customer and its children
   */
  async getAllLocations(customerId: number): Promise<any[]> {
    const result = await this.customerRepo.query(
      'SELECT * FROM get_customer_all_locations($1)',
      [customerId]
    );

    return result;
  }

  /**
   * Update location
   */
  async updateLocation(
    locationId: number,
    updateLocationDto: Partial<CreateLocationDto>
  ): Promise<CustomerLocation> {
    const location = await this.locationRepo.findOne({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    await this.locationRepo.update(locationId, {
      ...updateLocationDto,
      updated_at: new Date(),
    });

    return this.locationRepo.findOne({ where: { id: locationId } });
  }

  /**
   * Delete location
   */
  async removeLocation(locationId: number): Promise<void> {
    const location = await this.locationRepo.findOne({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    // Soft delete
    await this.locationRepo.update(locationId, {
      is_active: false,
      updated_at: new Date(),
    });
  }

  /**
   * Get customer statistics
   */
  async getStatistics(): Promise<any> {
    const total = await this.customerRepo.count({ where: { is_active: true } });
    const hoCount = await this.customerRepo.count({
      where: { customer_type: 'HO', is_active: true },
    });
    const branchCount = await this.customerRepo.count({
      where: { customer_type: 'Branch', is_active: true },
    });

    return {
      total,
      ho: hoCount,
      branches: branchCount,
    };
  }

  // Helper method to build hierarchy tree
  private buildHierarchyTree(flatData: any[]): any {
    const map = new Map();
    const roots: any[] = [];

    // First pass: create map
    flatData.forEach(item => {
      map.set(item.customer_id, { ...item, children: [] });
    });

    // Second pass: build tree
    flatData.forEach(item => {
      const node = map.get(item.customer_id);
      if (item.parent_id) {
        const parent = map.get(item.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}

export { Customer, CustomerLocation, CreateCustomerDto, CreateLocationDto };
