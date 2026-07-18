import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

function trimString({ value: rawValue }: TransformFnParams): unknown {
  const value: unknown = rawValue;
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateSheetDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class UpdateSheetDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class ReorderSheetDto {
  @IsInt()
  @Min(0)
  index: number;
}
