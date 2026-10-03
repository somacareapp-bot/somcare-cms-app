import { PartialType } from '@nestjs/mapped-types';
import { CreateRadiologyTestDto } from './create-radiology-test.dto';

export class UpdateRadiologyTestDto extends PartialType(CreateRadiologyTestDto) {}
