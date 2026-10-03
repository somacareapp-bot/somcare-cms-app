import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LabTestCatalogService } from './lab-test-catalog.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { SetTestComponentsDto } from './dto/set-test-components.dto';
import { SetTestCostModeDto } from './dto/set-test-cost-mode.dto';

// Matches the existing guard setup on this controller (JwtAuthGuard only, no
// PermissionsGuard). Costing configuration should be permission-gated before this
// ships to real users — see NOTES.md, "Still open".
@UseGuards(JwtAuthGuard)
@Controller('settings/laboratory/tests')
export class LabTestCatalogController {
  constructor(private readonly service: LabTestCatalogService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  // Static segments must stay above ':id' or Nest will match them as an id.
  @Get('costing')
  findCostingSummary(
    @Query('search') search?: string,
    @Query('includeComponents') includeComponents?: string,
  ) {
    return this.service.findCostingSummary(search, includeComponents === 'true');
  }

  @Post('seed')
  seed() {
    return this.service.seedIfEmpty();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/components')
  getComponents(@Param('id') id: string) {
    return this.service.getComponents(id);
  }

  @Put(':id/components')
  setComponents(@Param('id') id: string, @Body() dto: SetTestComponentsDto) {
    return this.service.setComponents(id, dto);
  }

  @Get(':id/cost-breakdown')
  getCostBreakdown(@Param('id') id: string) {
    return this.service.getCostBreakdown(id);
  }

  @Patch(':id/cost-mode')
  setCostMode(@Param('id') id: string, @Body() dto: SetTestCostModeDto) {
    return this.service.setCostMode(id, dto);
  }

  @Post()
  create(@Body() dto: CreateLabTestDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLabTestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
