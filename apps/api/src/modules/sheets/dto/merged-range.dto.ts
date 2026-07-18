import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MergeCellsDto {
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

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}

export class UnmergeCellsDto extends MergeCellsDto {}
