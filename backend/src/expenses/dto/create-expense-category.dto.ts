import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString()
  code: string;

  @IsString()
  label: string;

  @IsString()
  groupId: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
