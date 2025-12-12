import { IsString, IsOptional, IsInt, IsBoolean, IsArray, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConditionalRuleDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    priority?: number;

    @IsArray()
    @IsString({ each: true })
    ranges: string[];

    @IsObject()
    conditions: Record<string, any>;

    @IsObject()
    format: Record<string, any>;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateConditionalRuleDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    priority?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    ranges?: string[];

    @IsOptional()
    @IsObject()
    conditions?: Record<string, any>;

    @IsOptional()
    @IsObject()
    format?: Record<string, any>;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class ReorderRulesDto {
    @IsArray()
    @IsString({ each: true })
    ruleIds: string[];
}
