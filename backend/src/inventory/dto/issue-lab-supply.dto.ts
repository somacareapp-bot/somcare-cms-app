import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class IssueLabSupplyDto {
  @IsNumber() @Min(1)
  quantity: number;

  @IsOptional() @IsString()
  reason?: string;
}
