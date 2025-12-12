import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { ActivityTrackerService } from './activity-tracker.service';
import { ActivityTrackerController } from './activity-tracker.controller';

@Module({
    imports: [PrismaModule],
    controllers: [ActivityTrackerController],
    providers: [ActivityTrackerService],
    exports: [ActivityTrackerService],
})
export class ActivityTrackerModule { }
