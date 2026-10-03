import { PartialType } from '@nestjs/mapped-types';
import { CreateInsuranceProviderDto } from './create-insurance-provider.dto';

export class UpdateInsuranceProviderDto extends PartialType(CreateInsuranceProviderDto) {}
