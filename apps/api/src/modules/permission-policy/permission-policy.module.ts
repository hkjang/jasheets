import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { PermissionPolicyService } from './permission-policy.service';
import { PermissionPolicyController } from './permission-policy.controller';

@Module({
    imports: [PrismaModule],
    controllers: [PermissionPolicyController],
    providers: [PermissionPolicyService],
    exports: [PermissionPolicyService],
})
export class PermissionPolicyModule { }
