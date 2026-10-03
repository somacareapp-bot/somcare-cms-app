import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepartmentsService } from './departments.service';

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; rooms?: number; headDoctorId?: string }) {
    return this.departmentsService.create(body.name, body.rooms, body.headDoctorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; rooms?: number; headDoctorId?: string | null },
  ) {
    return this.departmentsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
