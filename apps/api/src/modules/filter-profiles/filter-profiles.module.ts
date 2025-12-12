import { Module } from '@nestjs/common';
import { FilterProfilesController } from './filter-profiles.controller';
import { FilterProfilesService } from './filter-profiles.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FilterProfilesController],
    providers: [FilterProfilesService],
    exports: [FilterProfilesService],
})
export class FilterProfilesModule { }
