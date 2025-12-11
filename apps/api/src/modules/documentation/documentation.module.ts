import { Module } from '@nestjs/common';
import { DocumentationService } from './documentation.service';
import { DocumentationController } from './documentation.controller';
import { NormalizerModule } from '../normalizer/normalizer.module';

@Module({
    imports: [NormalizerModule],
    controllers: [DocumentationController],
    providers: [DocumentationService],
    exports: [DocumentationService],
})
export class DocumentationModule { }
