import { IsString, IsOptional, IsBoolean, IsObject, IsArray } from 'class-validator';

export class CreateSheetAutomationDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsObject()
    trigger: {
        eventType: string; // CELL_CHANGE, ROW_INSERT, ROW_DELETE, FORMULA_RECALC, etc.
        conditions?: Array<{
            field: string;
            operator: string;
            value: any;
        }>;
    };

    @IsArray()
    actions: Array<{
        type: string; // SET_VALUE, SEND_NOTIFICATION, CALL_WEBHOOK, RUN_FORMULA, etc.
        config: Record<string, any>;
    }>;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateSheetAutomationDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsObject()
    trigger?: {
        eventType: string;
        conditions?: Array<{
            field: string;
            operator: string;
            value: any;
        }>;
    };

    @IsOptional()
    @IsArray()
    actions?: Array<{
        type: string;
        config: Record<string, any>;
    }>;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
