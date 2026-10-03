import { IsEnum } from 'class-validator';
import { VisitStatus } from '../entities/visit.entity';

export class UpdateVisitStatusDto {
  @IsEnum(VisitStatus)
  status: VisitStatus;
}
