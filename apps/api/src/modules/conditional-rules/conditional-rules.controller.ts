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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConditionalRulesService } from './conditional-rules.service';
import { CreateConditionalRuleDto, UpdateConditionalRuleDto, ReorderRulesDto } from './dto/conditional-rule.dto';

@Controller('sheets/:sheetId/conditional-rules')
@UseGuards(JwtAuthGuard)
export class ConditionalRulesController {
    constructor(private readonly conditionalRulesService: ConditionalRulesService) { }

    @Get()
    async getRules(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.conditionalRulesService.getRules(req.user.id, sheetId);
    }

    @Post()
    async createRule(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: CreateConditionalRuleDto,
    ) {
        return this.conditionalRulesService.createRule(req.user.id, sheetId, dto);
    }

    @Put('reorder')
    async reorderRules(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: ReorderRulesDto,
    ) {
        return this.conditionalRulesService.reorderRules(req.user.id, sheetId, dto.ruleIds);
    }

    @Put(':ruleId')
    async updateRule(
        @Request() req: any,
        @Param('ruleId') ruleId: string,
        @Body() dto: UpdateConditionalRuleDto,
    ) {
        return this.conditionalRulesService.updateRule(req.user.id, ruleId, dto);
    }

    @Delete(':ruleId')
    async deleteRule(
        @Request() req: any,
        @Param('ruleId') ruleId: string,
    ) {
        return this.conditionalRulesService.deleteRule(req.user.id, ruleId);
    }
}

