import { IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class UpdateLoginSessionSettingsDto {
  @IsOptional() @IsInt() @Min(1)
  sessionTimeout?: number;

  @IsOptional() @IsInt() @Min(1)
  maxLoginAttempts?: number;

  @IsOptional() @IsInt() @Min(0)
  passwordExpiry?: number;

  @IsOptional() @IsInt() @Min(1)
  minPasswordLength?: number;

  @IsOptional() @IsBoolean()
  require2fa?: boolean;

  @IsOptional() @IsBoolean()
  forceChange?: boolean;
}
