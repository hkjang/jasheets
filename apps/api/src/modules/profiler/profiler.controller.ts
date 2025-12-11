import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ProfilerService } from './profiler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface ProfileSheetDto {
    data: any[][];
    options?: {
        sheetName?: string;
        headers?: string[];
        detectOutliers?: boolean;
        calculateCorrelations?: boolean;
    };
}

interface ProfileColumnDto {
    data: any[];
    columnIndex?: number;
    columnName?: string;
    detectOutliers?: boolean;
}

@Controller('profiler')
@UseGuards(JwtAuthGuard)
export class ProfilerController {
    constructor(private readonly profilerService: ProfilerService) { }

    @Post('sheet')
    async profileSheet(@Body() dto: ProfileSheetDto) {
        return this.profilerService.profileSheet(dto.data, dto.options || {});
    }

    @Post('column')
    profileColumn(@Body() dto: ProfileColumnDto) {
        return this.profilerService.profileColumn(
            dto.data,
            dto.columnIndex || 0,
            dto.columnName || 'Column',
            dto.detectOutliers ?? true,
        );
    }
}
