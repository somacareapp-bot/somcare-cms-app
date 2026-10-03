import { IsEnum } from 'class-validator';
import { RadiologyOrderStatus } from '../entities/radiology-order.entity';

export class UpdateRadiologyOrderStatusDto {
  @IsEnum(RadiologyOrderStatus)
  status: RadiologyOrderStatus;
}
