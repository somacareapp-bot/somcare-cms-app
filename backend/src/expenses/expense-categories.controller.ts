import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './dto/create-expense-category.dto';

@UseGuards(JwtAuthGuard)
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @Get('groups')
  getGroups() {
    return this.service.getGroups();
  }

  // Any authenticated user can read (needed for the Expense submission form).
  @Get()
  getAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.getAll(includeInactive === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Post()
  create(@Body() dto: CreateExpenseCategoryDto) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseCategoryDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
