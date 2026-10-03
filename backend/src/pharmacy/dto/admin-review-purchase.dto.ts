import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PurchaseReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Administrator's decision on a submitted purchase
export class AdminReviewPurchaseDto {
  @IsEnum(PurchaseReviewDecision)
  decision: PurchaseReviewDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
