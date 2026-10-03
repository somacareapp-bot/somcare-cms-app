import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PurchaseDeptHeadDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Department head's decision on a newly-submitted pharmacy purchase (stage 1)
export class DeptHeadReviewPurchaseDto {
  @IsEnum(PurchaseDeptHeadDecision)
  decision: PurchaseDeptHeadDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
