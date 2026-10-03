import { IsArray, IsString, IsUUID, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class LabResultItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  resultValue: string;
}

export class UpdateLabResultDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LabResultItemDto)
  items: LabResultItemDto[];
}
