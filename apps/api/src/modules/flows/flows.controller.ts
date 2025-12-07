import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FlowsService } from './flows.service';
import * as FlowDtos from './dto/flow.dto';
import { FlowEngineService } from './flow-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('flows')
@UseGuards(JwtAuthGuard)
export class FlowsController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly flowEngineService: FlowEngineService,
  ) {}

  // =====================================================
  // Flow CRUD
  // =====================================================

  @Post()
  createFlow(@Request() req: any, @Body() dto: FlowDtos.CreateFlowDto) {
    return this.flowsService.createFlow(req.user.id, dto);
  }

  @Get('spreadsheet/:spreadsheetId')
  listFlows(
    @Request() req: any,
    @Param('spreadsheetId') spreadsheetId: string,
  ) {
    return this.flowsService.listFlows(req.user.id, spreadsheetId);
  }

  @Get(':flowId')
  getFlow(@Request() req: any, @Param('flowId') flowId: string) {
    return this.flowsService.getFlow(req.user.id, flowId);
  }

  @Put(':flowId')
  updateFlow(
    @Request() req: any,
    @Param('flowId') flowId: string,
    @Body() dto: FlowDtos.UpdateFlowDto,
  ) {
    return this.flowsService.updateFlow(req.user.id, flowId, dto);
  }

  @Delete(':flowId')
  deleteFlow(@Request() req: any, @Param('flowId') flowId: string) {
    return this.flowsService.deleteFlow(req.user.id, flowId);
  }

  // =====================================================
  // Version Management
  // =====================================================

  @Get(':flowId/versions')
  listFlowVersions(@Request() req: any, @Param('flowId') flowId: string) {
    return this.flowsService.listFlowVersions(req.user.id, flowId);
  }

  @Post(':flowId/versions/:versionId/rollback')
  rollbackToVersion(
    @Request() req: any,
    @Param('flowId') flowId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.flowsService.rollbackToVersion(req.user.id, flowId, versionId);
  }

  // =====================================================
  // Flow Execution
  // =====================================================

  @Post(':flowId/execute')
  async executeFlow(
    @Request() req: any,
    @Param('flowId') flowId: string,
    @Body() triggerData: any,
  ) {
    // Verify access first
    await this.flowsService.getFlow(req.user.id, flowId);
    
    const transactionId = await this.flowEngineService.executeFlow(flowId, triggerData);
    return { transactionId, message: 'Flow execution started' };
  }

  @Get(':flowId/executions')
  getFlowExecutions(
    @Request() req: any,
    @Param('flowId') flowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.flowsService.getFlowExecutions(
      req.user.id,
      flowId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('executions/:executionId')
  getFlowExecution(
    @Request() req: any,
    @Param('executionId') executionId: string,
  ) {
    return this.flowsService.getFlowExecution(req.user.id, executionId);
  }
}
