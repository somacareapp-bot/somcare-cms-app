import { IsString, IsOptional, IsArray, ValidateNested, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class LabSupplyPurchaseItemDto {
  @IsUUID()
  labSupplyId: string;

  @IsNumber() @Min(1)
  quantity: number;

  @IsNumber() @Min(0)
  costPrice: number;
}

export class CreateLabSupplyPurchaseDto {
  @IsString()
  supplierName: string;

  @IsOptional() @IsString()
  invoiceNumber?: string;

  @IsString()
  attachmentUrl: string;

  @IsOptional() @IsNumber() @Min(0)
  paidAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabSupplyPurchaseItemDto)
  items: LabSupplyPurchaseItemDto[];
}
