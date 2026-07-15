import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCellDto {
  @IsOptional()
  value?: any;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  formula?: string | null;

  @IsOptional()
  @IsObject()
  format?: any;
}

export class CellUpdateItem {
  @IsInt()
  @Min(0)
  row: number;

  @IsInt()
  @Min(0)
  col: number;

  @IsOptional()
  value?: any;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  formula?: string | null;

  @IsOptional()
  @IsObject()
  format?: any;
}

export class UpdateCellsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CellUpdateItem)
  updates: CellUpdateItem[];
}
