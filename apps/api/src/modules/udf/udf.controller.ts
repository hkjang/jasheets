import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { UDFService, CreateUDFDto, UpdateUDFDto } from './udf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface ExecuteUDFDto {
    args: any[];
}

interface TestUDFDto {
    code: string;
    args: any[];
}

@Controller('udf')
@UseGuards(JwtAuthGuard)
export class UDFController {
    constructor(private readonly udfService: UDFService) { }

    @Post('spreadsheet/:spreadsheetId')
    createUDF(
        @Request() req: any,
        @Param('spreadsheetId') spreadsheetId: string,
        @Body() dto: Omit<CreateUDFDto, 'spreadsheetId'>,
    ) {
        return this.udfService.createUDF(req.user.id, { ...dto, spreadsheetId });
    }

    @Get('spreadsheet/:spreadsheetId')
    getUDFs(@Param('spreadsheetId') spreadsheetId: string) {
        return this.udfService.getUDFs(spreadsheetId);
    }

    @Get('spreadsheet/:spreadsheetId/:name')
    getUDF(
        @Param('spreadsheetId') spreadsheetId: string,
        @Param('name') name: string,
    ) {
        return this.udfService.getUDF(spreadsheetId, name);
    }

    @Put('spreadsheet/:spreadsheetId/:name')
    updateUDF(
        @Param('spreadsheetId') spreadsheetId: string,
        @Param('name') name: string,
        @Body() dto: { name?: string; description?: string; code?: string; parameters?: any[]; returnType?: 'number' | 'string' | 'boolean' | 'array' | 'any' },
    ) {
        return this.udfService.updateUDF(spreadsheetId, name, dto);
    }

    @Delete('spreadsheet/:spreadsheetId/:name')
    deleteUDF(
        @Param('spreadsheetId') spreadsheetId: string,
        @Param('name') name: string,
    ) {
        return this.udfService.deleteUDF(spreadsheetId, name);
    }

    @Post('spreadsheet/:spreadsheetId/:name/execute')
    executeUDF(
        @Param('spreadsheetId') spreadsheetId: string,
        @Param('name') name: string,
        @Body() dto: ExecuteUDFDto,
    ) {
        return this.udfService.executeNamedUDF(spreadsheetId, name, dto.args);
    }

    @Post('test')
    testUDF(@Body() dto: TestUDFDto) {
        return this.udfService.executeUDF(dto.code, dto.args);
    }

    @Get('helpers')
    getHelpers() {
        return this.udfService.getBuiltInHelpers();
    }
}

