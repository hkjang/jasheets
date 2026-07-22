import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MAX_PIVOTS_PER_REQUEST = 50;
const MAX_PIVOT_FIELDS = 50;

export class PivotSourceRangeDto {
  @IsInt()
  @Min(0)
  @Max(999999)
  startRow: number;

  @IsInt()
  @Min(0)
  @Max(18277)
  startCol: number;

  @IsInt()
  @Min(0)
  @Max(999999)
  endRow: number;

  @IsInt()
  @Min(0)
  @Max(18277)
  endCol: number;
}

export class PivotValueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  field: string;

  @IsIn(['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX'])
  aggregation: 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';
}

export class PivotFilterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  field: string;

  @IsIn([
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'NOT_CONTAINS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'BETWEEN',
    'IN',
    'IS_BLANK',
    'IS_NOT_BLANK',
  ])
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'BETWEEN'
    | 'IN'
    | 'IS_BLANK'
    | 'IS_NOT_BLANK';

  @IsOptional()
  @Allow()
  value?: unknown;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  values?: unknown[];
}

export class PivotSortDto {
  @IsIn(['ASC', 'DESC'])
  direction: 'ASC' | 'DESC';

  @IsOptional()
  @IsIn(['LABEL', 'VALUE'])
  by?: 'LABEL' | 'VALUE';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  valueField?: string;

  @IsOptional()
  @IsIn(['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX'])
  aggregation?: 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';
}

export class PivotConfigDto {
  @ValidateNested()
  @Type(() => PivotSourceRangeDto)
  sourceRange: PivotSourceRangeDto;

  // The last materialized result footprint. It lets the client safely clear a
  // stale larger result before writing a recalculated, smaller pivot.
  @IsOptional()
  @ValidateNested()
  @Type(() => PivotSourceRangeDto)
  outputRange?: PivotSourceRangeDto;

  @IsArray()
  @ArrayMaxSize(MAX_PIVOT_FIELDS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(256, { each: true })
  rows: string[];

  @IsArray()
  @ArrayMaxSize(MAX_PIVOT_FIELDS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(256, { each: true })
  cols: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PIVOT_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => PivotValueDto)
  values: PivotValueDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PIVOT_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => PivotFilterDto)
  filters?: PivotFilterDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PivotSortDto)
  rowSort?: PivotSortDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PivotSortDto)
  colSort?: PivotSortDto;

  @IsOptional()
  @IsBoolean()
  rowGrandTotals?: boolean;

  @IsOptional()
  @IsBoolean()
  columnGrandTotals?: boolean;
}

export class PivotTableDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ValidateNested()
  @Type(() => PivotConfigDto)
  config: PivotConfigDto;

  // Kept for persisted-record and older-client compatibility. The canonical
  // source is config.sourceRange; when supplied, this value must match it.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^\$?[A-Z]+\$?[1-9][0-9]*:\$?[A-Z]+\$?[1-9][0-9]*$/i)
  sourceRange?: string;

  @IsString()
  @MaxLength(16)
  @Matches(/^\$?[A-Z]+\$?[1-9][0-9]*$/i)
  targetCell: string;
}

export class SavePivotTablesDto {
  @IsArray()
  @ArrayMaxSize(MAX_PIVOTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => PivotTableDto)
  pivotTables: PivotTableDto[];

  @IsInt()
  @Min(0)
  expectedVersion: number;
}
