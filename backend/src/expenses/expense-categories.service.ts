import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from './entities/expense-category.entity';
import { ExpenseCategoryGroup } from './entities/expense-category-group.entity';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './dto/create-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory) private readonly categoriesRepo: Repository<ExpenseCategory>,
    @InjectRepository(ExpenseCategoryGroup) private readonly groupsRepo: Repository<ExpenseCategoryGroup>,
  ) {}

  getGroups() {
    return this.groupsRepo.find({ order: { sortOrder: 'ASC' } });
  }

  // includeInactive: the Expense submission form should only ever offer
  // active categories; the Settings management screen needs to see
  // deactivated ones too so they can be reactivated.
  getAll(includeInactive = false) {
    return this.categoriesRepo.find({
      where: includeInactive ? {} : { active: true },
      relations: ['group'],
      order: { sortOrder: 'ASC' },
    });
  }

  async findActiveByCode(code: string): Promise<ExpenseCategory | null> {
    return this.categoriesRepo.findOne({ where: { code, active: true } });
  }

  async create(dto: CreateExpenseCategoryDto) {
    const existing = await this.categoriesRepo.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Category code "${dto.code}" already exists`);
    const group = await this.groupsRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new BadRequestException('Unknown group');
    const category = this.categoriesRepo.create({
      code: dto.code,
      label: dto.label,
      groupId: dto.groupId,
      sortOrder: dto.sortOrder ?? 0,
      active: true,
    });
    return this.categoriesRepo.save(category);
  }

  async update(id: string, dto: UpdateExpenseCategoryDto) {
    const category = await this.categoriesRepo.findOne({ where: { id } });
    if (!category) throw new BadRequestException('Category not found');
    Object.assign(category, dto);
    return this.categoriesRepo.save(category);
  }

  // Soft-disable only — a category that has ever been used on a real Expense
  // must keep existing so historical rows still resolve to a real label.
  async deactivate(id: string) {
    return this.update(id, { active: false });
  }
}
