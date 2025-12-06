import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateSpreadsheetDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  data?: any;
}
