import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCellDto {
  @IsOptional()
  value?: any;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsObject()
  format?: any;
}

export class CellUpdateItem {
  @IsNumber()
  row: number;

  @IsNumber()
  col: number;

  @IsOptional()
  value?: any;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsObject()
  format?: any;
}

export class UpdateCellsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CellUpdateItem)
  updates: CellUpdateItem[];
}
