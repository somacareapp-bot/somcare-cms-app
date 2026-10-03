import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DeptHeadDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Department head's decision on a newly-submitted expense (stage 1)
export class DeptHeadReviewExpenseDto {
  @IsEnum(DeptHeadDecision)
  decision: DeptHeadDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
