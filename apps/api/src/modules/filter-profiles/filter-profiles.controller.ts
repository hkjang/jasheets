import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilterProfilesService } from './filter-profiles.service';
import { CreateFilterProfileDto, UpdateFilterProfileDto } from './dto/filter-profile.dto';

@Controller('sheets/:sheetId/filter-profiles')
@UseGuards(JwtAuthGuard)
export class FilterProfilesController {
    constructor(private readonly filterProfilesService: FilterProfilesService) { }

    @Get()
    async getProfiles(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.filterProfilesService.getProfiles(req.user.id, sheetId);
    }

    @Get('default')
    async getDefaultProfile(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.filterProfilesService.getDefaultProfile(req.user.id, sheetId);
    }

    @Get(':profileId')
    async getProfile(
        @Request() req: any,
        @Param('profileId') profileId: string,
    ) {
        return this.filterProfilesService.getProfile(req.user.id, profileId);
    }

    @Post()
    async createProfile(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: CreateFilterProfileDto,
    ) {
        return this.filterProfilesService.createProfile(req.user.id, sheetId, dto);
    }

    @Put(':profileId')
    async updateProfile(
        @Request() req: any,
        @Param('profileId') profileId: string,
        @Body() dto: UpdateFilterProfileDto,
    ) {
        return this.filterProfilesService.updateProfile(req.user.id, profileId, dto);
    }

    @Delete(':profileId')
    async deleteProfile(
        @Request() req: any,
        @Param('profileId') profileId: string,
    ) {
        return this.filterProfilesService.deleteProfile(req.user.id, profileId);
    }

    @Post(':profileId/set-default')
    async setDefaultProfile(
        @Request() req: any,
        @Param('profileId') profileId: string,
    ) {
        return this.filterProfilesService.setDefaultProfile(req.user.id, profileId);
    }
}
