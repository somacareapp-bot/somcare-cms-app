import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TestComponentDto {
  @IsUUID()
  labSupplyId: string;

  @IsNumber() @Min(1)
  quantityPerTest: number;

  // Cost-only allowance. Percent, not a fraction: 5 means 5%.
  @IsOptional() @IsNumber() @Min(0) @Max(100)
  wastagePercent?: number;

  @IsOptional() @IsString()
  notes?: string;
}

/**
 * Full replacement of a test's recipe. Sending an empty array clears it, which is
 * the only way to say "this test consumes nothing" explicitly.
 */
export class SetTestComponentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestComponentDto)
  components: TestComponentDto[];
}
