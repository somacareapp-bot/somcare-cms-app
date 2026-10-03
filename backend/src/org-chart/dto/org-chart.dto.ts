import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, IsUUID, Min, IsNotEmpty, IsIn } from 'class-validator';
import { NodeStatus } from '../entities/org-chart-node.entity';

export class CreateOrgChartNodeDto {
  @ApiProperty({ example: 'Chief Executive Officer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  headcount?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ enum: NodeStatus })
  @IsEnum(NodeStatus)
  @IsOptional()
  status?: NodeStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ enum: ['role', 'department', 'position'] })
  @IsIn(['role', 'department', 'position'])
  @IsOptional()
  linkType?: 'role' | 'department' | 'position' | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkValue?: string | null;

  @ApiPropertyOptional({ description: 'User who occupies this box (expense approval routing)' })
  @IsUUID()
  @IsOptional()
  linkedUserId?: string | null;
}

export class UpdateOrgChartNodeDto extends PartialType(CreateOrgChartNodeDto) {}
