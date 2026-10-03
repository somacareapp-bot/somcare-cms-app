import { PartialType } from '@nestjs/mapped-types';
import { CreateLabSupplyDto } from './create-lab-supply.dto';

export class UpdateLabSupplyDto extends PartialType(CreateLabSupplyDto) {}
