import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsInt, IsIn, Min, Matches, MaxLength } from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveTypeDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;

  @IsOptional() @IsString()
  description?: string | null;

  @IsOptional() @IsNumber() @Min(0)
  accrualPerMonth?: number;

  @IsOptional() @IsNumber() @Min(0)
  maxDaysPerYear?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  maxDaysPerRequest?: number | null;

  @IsOptional() @IsBoolean()
  isPaid?: boolean;

  @IsOptional() @IsBoolean()
  isUnlimited?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  color?: string;
}

export class UpdateLeaveTypeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80)
  name?: string;

  @IsOptional() @IsString()
  description?: string | null;

  @IsOptional() @IsNumber() @Min(0)
  accrualPerMonth?: number;

  @IsOptional() @IsNumber() @Min(0)
  maxDaysPerYear?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  maxDaysPerRequest?: number | null;

  @IsOptional() @IsBoolean()
  isPaid?: boolean;

  @IsOptional() @IsBoolean()
  isUnlimited?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  color?: string;
}

export class CreateLeaveRequestDto {
  @IsString() @IsNotEmpty()
  leaveTypeId: string;

  @Matches(DATE_RE, { message: 'startDate must be YYYY-MM-DD' })
  startDate: string;

  @Matches(DATE_RE, { message: 'endDate must be YYYY-MM-DD' })
  endDate: string;

  @IsOptional() @IsString() @MaxLength(1000)
  reason?: string;
}

export class LeaveDecisionDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class AdjustBalanceDto {
  @IsString() @IsNotEmpty()
  userId: string;

  @IsString() @IsNotEmpty()
  leaveTypeId: string;

  @IsInt()
  year: number;

  @IsNumber()
  days: number;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
