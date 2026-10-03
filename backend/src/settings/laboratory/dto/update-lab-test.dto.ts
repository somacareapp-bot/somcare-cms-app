import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min } from 'class-validator';

export class UpdateLabTestDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  unit?: string;

  @IsOptional() @IsString()
  referenceRange?: string;

  @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @IsBoolean()
  isPanel?: boolean;

  @IsOptional() @IsUUID()
  panelId?: string;
}
