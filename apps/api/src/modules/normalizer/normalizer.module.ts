import { Module } from '@nestjs/common';
import { NormalizerService } from './normalizer.service';
import { NormalizerController } from './normalizer.controller';

@Module({
    controllers: [NormalizerController],
    providers: [NormalizerService],
    exports: [NormalizerService],
})
export class NormalizerModule { }
