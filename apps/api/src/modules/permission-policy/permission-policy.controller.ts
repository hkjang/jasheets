import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionPolicyService } from './permission-policy.service';
import type { CreatePermissionPolicyDto, UpdatePermissionPolicyDto } from './permission-policy.service';


@Controller('admin/permission-policies')
@UseGuards(JwtAuthGuard)
export class PermissionPolicyController {
    constructor(private readonly permissionPolicyService: PermissionPolicyService) { }

    @Post()
    async create(@Body() dto: CreatePermissionPolicyDto) {
        return this.permissionPolicyService.create(dto);
    }

    @Get()
    async findAll() {
        return this.permissionPolicyService.findAll();
    }

    @Get('default')
    async findDefault() {
        const policy = await this.permissionPolicyService.findDefault();
        if (!policy) {
            return { rules: this.permissionPolicyService.getDefaultRules() };
        }
        return policy;
    }

    @Get('default-rules')
    getDefaultRules() {
        return this.permissionPolicyService.getDefaultRules();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.permissionPolicyService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdatePermissionPolicyDto) {
        return this.permissionPolicyService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string) {
        await this.permissionPolicyService.delete(id);
    }
}

