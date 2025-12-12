import { IsString, IsOptional, IsBoolean, IsArray, IsInt, IsObject } from 'class-validator';

export class CreateFilterProfileDto {
    @IsString()
    name: string;

    @IsArray()
    filters: Array<{
        column: number;
        operator: string;
        value: any;
    }>;

    @IsOptional()
    @IsArray()
    sortings?: Array<{
        column: number;
        direction: 'asc' | 'desc';
    }>;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    hiddenCols?: number[];

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    hiddenRows?: number[];

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}

export class UpdateFilterProfileDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsArray()
    filters?: Array<{
        column: number;
        operator: string;
        value: any;
    }>;

    @IsOptional()
    @IsArray()
    sortings?: Array<{
        column: number;
        direction: 'asc' | 'desc';
    }>;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    hiddenCols?: number[];

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    hiddenRows?: number[];

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
