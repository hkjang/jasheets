import { IsEnum, IsEmail, IsOptional, IsString } from 'class-validator';
import { SheetPermissionRole } from '@prisma/client';

export class CreateSheetPermissionDto {
    @IsOptional()
    @IsString()
    userId?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsEnum(SheetPermissionRole)
    role: SheetPermissionRole;
}

export class UpdateSheetPermissionDto {
    @IsEnum(SheetPermissionRole)
    role: SheetPermissionRole;
}
