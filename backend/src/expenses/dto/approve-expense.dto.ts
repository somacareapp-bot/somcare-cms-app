import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ApprovalDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Admin's final decision on a dept-head-approved expense
export class ApproveExpenseDto {
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
