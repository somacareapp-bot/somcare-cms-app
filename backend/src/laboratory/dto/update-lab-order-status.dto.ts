import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LabOrderStatus } from '../entities/lab-order.entity';

export class UpdateLabOrderStatusDto {
  @IsEnum(LabOrderStatus)
  status: LabOrderStatus;

  // Set by the controller from req.user?.id — not sent by the client.
  // Needed here because updateStatus() now dispenses stock (at
  // SAMPLE_COLLECTED) and the stock log records who did it.
  @IsOptional()
  @IsString()
  userId?: string;
}
