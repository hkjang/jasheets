import { Module, forwardRef } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowEngineService } from './flow-engine.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [WebhooksModule, forwardRef(() => EventsModule)],
  controllers: [FlowsController],
  providers: [FlowsService, FlowEngineService],
  exports: [FlowsService, FlowEngineService],
})
export class FlowsModule { }

