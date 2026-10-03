import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum LabSupplyDeptHeadDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Department head's decision on a newly-submitted lab supply purchase (stage 1)
export class DeptHeadReviewLabSupplyPurchaseDto {
  @IsEnum(LabSupplyDeptHeadDecision)
  decision: LabSupplyDeptHeadDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
