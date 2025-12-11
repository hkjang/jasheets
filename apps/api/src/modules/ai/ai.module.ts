import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { SheetBuilderService } from './sheet-builder.service';

@Module({
  imports: [ConfigModule],
  controllers: [AIController],
  providers: [AIService, SheetBuilderService],
  exports: [AIService, SheetBuilderService],
})
export class AIModule { }

