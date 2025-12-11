import { Module } from '@nestjs/common';
import { ProfilerService } from './profiler.service';
import { ProfilerController } from './profiler.controller';

@Module({
    controllers: [ProfilerController],
    providers: [ProfilerService],
    exports: [ProfilerService],
})
export class ProfilerModule { }
