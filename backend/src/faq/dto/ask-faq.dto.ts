import { IsString, IsNotEmpty } from 'class-validator';

export class AskFaqDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}
