import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InsuranceProviderStatus } from '../entities/insurance-provider.entity';

export class CreateInsuranceProviderDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  coverage?: string;

  @IsOptional() @IsString()
  contact?: string;

  @IsOptional() @IsEnum(InsuranceProviderStatus)
  status?: InsuranceProviderStatus;
}
