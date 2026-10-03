import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum LabSupplyPurchaseReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Administrator's decision on a submitted lab supply purchase
export class AdminReviewLabSupplyPurchaseDto {
  @IsEnum(LabSupplyPurchaseReviewDecision)
  decision: LabSupplyPurchaseReviewDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
