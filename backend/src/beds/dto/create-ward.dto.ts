import { IsString, IsUUID, IsInt, Min, IsOptional } from 'class-validator';

export class CreateWardDto {
  @IsString()
  name: string;

  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalBeds?: number;
}
