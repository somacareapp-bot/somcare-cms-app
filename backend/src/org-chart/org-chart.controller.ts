import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { OrgChartService } from './org-chart.service';
import { CreateOrgChartNodeDto, UpdateOrgChartNodeDto } from './dto/org-chart.dto';

@ApiTags('Org Chart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('org-chart')
export class OrgChartController {
  constructor(private readonly service: OrgChartService) {}

  @Permissions('orgchart:read')
  @Get('tree')
  @ApiOperation({ summary: 'Get full hierarchy as nested tree' })
  getTree() { return this.service.getTree(); }

  @Permissions('orgchart:read')
  @Get()
  @ApiOperation({ summary: 'Get all nodes flat' })
  findAll() { return this.service.findAll(); }

  @Permissions('orgchart:read')
  @Get(':id')
  @ApiOperation({ summary: 'Get single node' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Permissions('orgchart:create')
  @Post()
  @ApiOperation({ summary: 'Create node' })
  create(@Body() dto: CreateOrgChartNodeDto) { return this.service.create(dto); }

  @Permissions('orgchart:update')
  @Patch(':id')
  @ApiOperation({ summary: 'Update node' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrgChartNodeDto) { return this.service.update(id, dto); }

  @Permissions('orgchart:delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete node' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
