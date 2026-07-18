import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RowMetaDto {
  @IsInt()
  @Min(0)
  row: number;

  @IsInt()
  @Min(20)
  @Max(400)
  height: number;

  @IsBoolean()
  hidden: boolean;
}

export class ColMetaDto {
  @IsInt()
  @Min(0)
  col: number;

  @IsInt()
  @Min(30)
  @Max(500)
  width: number;

  @IsBoolean()
  hidden: boolean;
}

export class SheetViewDto {
  @IsInt()
  @Min(0)
  frozenRows: number;

  @IsInt()
  @Min(0)
  frozenCols: number;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => RowMetaDto)
  rowMeta: RowMetaDto[];

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ColMetaDto)
  colMeta: ColMetaDto[];
}
