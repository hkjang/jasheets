import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { TargetType, EventType } from '@prisma/client';

// FilterConditions must be defined BEFORE it's used in other classes
export class FilterConditions {
  @IsOptional()
  @IsString()
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'changed' | 'type_changed';

  @IsOptional()
  value?: any;

  @IsOptional()
  @IsString()
  dataType?: 'string' | 'number' | 'boolean' | 'date';
}

export class CreateEventRuleDto {
  @IsString()
  spreadsheetId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @IsOptional()
  @IsString()
  sheetId?: string;

  @IsOptional()
  @IsString()
  cellRange?: string;

  @IsOptional()
  @IsArray()
  cellCoordinates?: { row: number; col: number }[];

  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes?: EventType[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FilterConditions)
  filterConditions?: FilterConditions;

  @IsOptional()
  @IsBoolean()
  batchMode?: boolean;

  @IsOptional()
  @IsInt()
  batchWindow?: number;

  @IsOptional()
  @IsString()
  webhookId?: string;

  @IsOptional()
  @IsString()
  flowId?: string;
}

export class UpdateEventRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @IsOptional()
  @IsString()
  sheetId?: string;

  @IsOptional()
  @IsString()
  cellRange?: string;

  @IsOptional()
  @IsArray()
  cellCoordinates?: { row: number; col: number }[];

  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  eventTypes?: EventType[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FilterConditions)
  filterConditions?: FilterConditions;

  @IsOptional()
  @IsBoolean()
  batchMode?: boolean;

  @IsOptional()
  @IsInt()
  batchWindow?: number;

  @IsOptional()
  @IsString()
  webhookId?: string;

  @IsOptional()
  @IsString()
  flowId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
