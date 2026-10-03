import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewDecision {
  CONFIRM = 'confirm',
  REJECT = 'reject',
}

// Accountant's decision on a pending (or sent-back) expense
export class ReviewExpenseDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
