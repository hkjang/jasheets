import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowEngineService } from './flow-engine.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule],
  controllers: [FlowsController],
  providers: [FlowsService, FlowEngineService],
  exports: [FlowsService, FlowEngineService],
})
export class FlowsModule {}
