import { Type, Transform, type TransformFnParams } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class WorkbookImportCellDto {
  @IsInt()
  @Min(0)
  @Max(999999)
  row: number;

  @IsInt()
  @Min(0)
  @Max(18277)
  col: number;

  @IsOptional()
  @Allow()
  value?: unknown;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50000)
  formula?: string | null;

  @IsOptional()
  @IsObject()
  format?: Record<string, unknown>;
}

export class WorkbookImportRowMetaDto {
  @IsInt()
  @Min(0)
  @Max(999999)
  row: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(400)
  height?: number;

  @IsBoolean()
  hidden: boolean;
}

export class WorkbookImportColMetaDto {
  @IsInt()
  @Min(0)
  @Max(18277)
  col: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(500)
  width?: number;

  @IsBoolean()
  hidden: boolean;
}

export class WorkbookImportMergedRangeDto {
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

export class WorkbookImportSheetDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  rowCount: number;

  @IsInt()
  @Min(1)
  @Max(18278)
  colCount: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  frozenRows: number;

  @IsInt()
  @Min(0)
  @Max(18278)
  frozenCols: number;

  @IsInt()
  @Min(20)
  @Max(400)
  defaultRowHeight: number;

  @IsInt()
  @Min(30)
  @Max(500)
  defaultColWidth: number;

  @IsArray()
  @ArrayMaxSize(100000)
  @ValidateNested({ each: true })
  @Type(() => WorkbookImportCellDto)
  cells: WorkbookImportCellDto[];

  @IsArray()
  @ArrayMaxSize(50000)
  @ValidateNested({ each: true })
  @Type(() => WorkbookImportRowMetaDto)
  rowMeta: WorkbookImportRowMetaDto[];

  @IsArray()
  @ArrayMaxSize(18278)
  @ValidateNested({ each: true })
  @Type(() => WorkbookImportColMetaDto)
  colMeta: WorkbookImportColMetaDto[];

  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => WorkbookImportMergedRangeDto)
  mergedRanges: WorkbookImportMergedRangeDto[];
}

export class ExpectedSheetVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sheetId: string;

  @IsInt()
  @Min(0)
  version: number;
}

export class ImportWorkbookDto {
  @IsIn(['append', 'replace'])
  mode: 'append' | 'replace';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkbookImportSheetDto)
  sheets: WorkbookImportSheetDto[];

  // This must describe every current tab. It is both a cell-content CAS and a
  // tab-set guard, so an import never silently races another editor.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExpectedSheetVersionDto)
  expectedSheetVersions: ExpectedSheetVersionDto[];
}
