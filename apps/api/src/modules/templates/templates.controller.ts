import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() data: Prisma.TemplateCreateInput) {
    return this.templatesService.create(data);
  }

  @Get()
  findAll(@Query('category') category?: string) {
    return this.templatesService.findAll(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() data: Prisma.TemplateUpdateInput) {
    return this.templatesService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
