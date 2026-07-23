import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchWorkbookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsIn(['all', 'values', 'formulas'])
  mode: 'all' | 'values' | 'formulas' = 'all';

  @IsOptional()
  @IsUUID()
  sheetId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  matchCase = false;
}
