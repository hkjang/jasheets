import { Module, forwardRef } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { FlowsModule } from '../flows/flows.module';

@Module({
  imports: [WebhooksModule, forwardRef(() => FlowsModule)],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule { }

