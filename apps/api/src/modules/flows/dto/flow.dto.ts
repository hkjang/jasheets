import { IsString, IsOptional, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// =====================================================
// Node & Edge Types (not classes - used as JSON)
// =====================================================

export interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'transform' | 'http_request' | 'notification' | 'db_write' | 'end';
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
}

export interface NodeExecutionContext {
  transactionId: string;
  flowExecutionId: string;
  inputData: any;
  variables: Map<string, any>;
}

// =====================================================
// DTOs (classes for NestJS validation)
// =====================================================

export class CreateFlowDto {
  @IsString()
  spreadsheetId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  nodes?: FlowNode[];

  @IsOptional()
  @IsArray()
  edges?: FlowEdge[];
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  nodes?: FlowNode[];

  @IsOptional()
  @IsArray()
  edges?: FlowEdge[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
