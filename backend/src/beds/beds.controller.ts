import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BedsService } from './beds.service';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { AssignBedDto } from './dto/assign-bed.dto';

@UseGuards(JwtAuthGuard)
@Controller('beds')
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Get()
  findAll(@Query('wardId') wardId?: string) {
    return this.bedsService.findAll(wardId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bedsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBedDto) {
    return this.bedsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.bedsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bedsService.remove(id);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignBedDto) {
    return this.bedsService.assign(id, dto);
  }

  @Patch(':id/discharge')
  discharge(@Param('id') id: string) {
    return this.bedsService.discharge(id);
  }
}
