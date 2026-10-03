import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min } from 'class-validator';

export class CreateLabTestDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  unit?: string;

  @IsOptional() @IsString()
  referenceRange?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional() @IsBoolean()
  isPanel?: boolean;

  @IsOptional() @IsUUID()
  panelId?: string;
}
