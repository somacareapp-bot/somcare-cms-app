import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateRadiologyTestDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;
}
