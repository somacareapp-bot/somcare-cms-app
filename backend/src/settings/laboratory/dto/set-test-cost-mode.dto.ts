import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LabTestCostMode } from '../entities/lab-test-catalog.entity';

export class SetTestCostModeDto {
  @IsEnum(LabTestCostMode)
  costCalculationMode: LabTestCostMode;

  // Required when mode = manual: the final cost per test, not the adjustment.
  // The service derives the adjustment as (override - autoCost) for display.
  @IsOptional() @IsNumber() @Min(0)
  manualCostOverride?: number;

  @IsOptional() @IsString()
  manualCostReason?: string;
}
