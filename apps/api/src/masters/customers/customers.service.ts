// Customers Service
// Handles customer CRUD and hierarchy management
// apps/api/src/masters/customers/customers.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';

interface CreateCustomerDto {
  customerCode: string;
  customerName: string;
  customerType?: string;
  parentCustomerId?: number;
  contactPerson?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  industry?: string;
  companySize?: string;
  taxId?: string;
  notes?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  /**
   * Create a new customer
   */
  async create(createCustomerDto: CreateCustomerDto, userId: number): Promise<Customer> {
    // Check if customer code already exists
    const existing = await this.customerRepo.findOne({
      where: { customerCode: createCustomerDto.customerCode },
    });

    if (existing) {
      throw new BadRequestException('Customer code already exists');
    }

    // If parent_customer_id is provided, validate it exists
    if (createCustomerDto.parentCustomerId) {
      const parent = await this.customerRepo.findOne({
        where: { id: createCustomerDto.parentCustomerId },
      });

      if (!parent) {
        throw new NotFoundException('Parent customer not found');
      }
    }

    const customer = this.customerRepo.create({
      ...createCustomerDto,
      customerType: createCustomerDto.customerType || 'Branch',
      country: createCustomerDto.country || 'India',
      isActive: true,
      createdBy: userId,
    });

    return this.customerRepo.save(customer);
  }

  /**
   * Get all customers with optional filters
   */
  async findAll(filters?: {
    customerType?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<Customer[]> {
    const query = this.customerRepo.createQueryBuilder('c');

    if (filters?.customerType) {
      query.andWhere('c.customer_type = :type', { type: filters.customerType });
    }

    if (filters?.isActive !== undefined) {
      query.andWhere('c.is_active = :active', { active: filters.isActive });
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
    if (updateCustomerDto.customerCode && updateCustomerDto.customerCode !== customer.customerCode) {
      const existing = await this.customerRepo.findOne({
        where: { customerCode: updateCustomerDto.customerCode },
      });

      if (existing) {
        throw new BadRequestException('Customer code already exists');
      }
    }

    // If updating parent, validate it exists and prevent circular reference
    if (updateCustomerDto.parentCustomerId) {
      if (updateCustomerDto.parentCustomerId === id) {
        throw new BadRequestException('Customer cannot be its own parent');
      }

      const parent = await this.customerRepo.findOne({
        where: { id: updateCustomerDto.parentCustomerId },
      });

      if (!parent) {
        throw new NotFoundException('Parent customer not found');
      }
    }

    await this.customerRepo.update(id, {
      ...updateCustomerDto,
      updatedBy: userId,
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
      where: { parentCustomerId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException('Cannot delete customer with child branches');
    }

    // Soft delete
    await this.customerRepo.update(id, {
      isActive: false,
      updatedBy: userId,
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
        customerType: 'HO',
        isActive: true,
      },
      order: {
        customerName: 'ASC',
      },
    });
  }

  /**
   * Get branches for a customer
   */
  async getBranches(parentId: number): Promise<Customer[]> {
    return this.customerRepo.find({
      where: {
        parentCustomerId: parentId,
        isActive: true,
      },
      order: {
        customerName: 'ASC',
      },
    });
  }

  /**
   * Get customer statistics
   */
  async getStatistics(): Promise<any> {
    const total = await this.customerRepo.count({ where: { isActive: true } });
    const hoCount = await this.customerRepo.count({
      where: { customerType: 'HO', isActive: true },
    });
    const branchCount = await this.customerRepo.count({
      where: { customerType: 'Branch', isActive: true },
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

export type { CreateCustomerDto };