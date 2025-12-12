import { IsString, IsOptional, IsDateString } from 'class-validator';

export class GetRevisionsDto {
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    action?: string;
}
