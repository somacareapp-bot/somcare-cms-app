import { IsOptional, IsString } from 'class-validator';

export class UpdateFacilitySettingsDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() eDahabNumber?: string;
  @IsOptional() @IsString() zaadNumber?: string;
  @IsOptional() @IsString() accountNumber?: string;
}
