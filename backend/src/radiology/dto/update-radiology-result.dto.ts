import { IsArray, IsString, IsUUID, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class RadiologyResultItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  resultText: string;
}

export class UpdateRadiologyResultDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RadiologyResultItemDto)
  items: RadiologyResultItemDto[];
}
