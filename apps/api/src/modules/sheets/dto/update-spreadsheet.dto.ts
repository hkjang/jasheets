import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateSpreadsheetDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
