import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Template, Prisma } from '@prisma/client';

export interface CloneOptions {
  includeData?: boolean;
  includeFormulas?: boolean;
  includeFormatting?: boolean;
  includeConditionalRules?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) { }

  async create(data: Prisma.TemplateCreateInput): Promise<Template> {
    return this.prisma.template.create({ data });
  }

  async findAll(category?: string): Promise<Template[]> {
    const where: Prisma.TemplateWhereInput = {};
    if (category) {
      where.category = category;
    }
    return this.prisma.template.findMany({
      where,
      orderBy: { order: 'asc' }
    });
  }

  async findOne(id: string): Promise<Template> {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  async update(id: string, data: Prisma.TemplateUpdateInput): Promise<Template> {
    await this.findOne(id);
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Template> {
    await this.findOne(id);
    return this.prisma.template.delete({ where: { id } });
  }

  /**
   * Create a template snapshot from an existing sheet
   */
  async createSnapshotFromSheet(
    userId: string,
    sheetId: string,
    templateName: string,
    description?: string,
    category?: string,
  ): Promise<Template> {
    // Get sheet with all its data
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      include: {
        spreadsheet: true,
        cells: true,
        rowMeta: true,
        colMeta: true,
        conditionalRules: true,
      },
    });

    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    // Check access
    const isOwner = sheet.spreadsheet.ownerId === userId;
    if (!isOwner) {
      const permission = await this.prisma.permission.findFirst({
        where: {
          spreadsheetId: sheet.spreadsheetId,
          userId,
        },
      });
      if (!permission) {
        throw new ForbiddenException('No access to this sheet');
      }
    }

    // Create template data snapshot
    const templateData = {
      sheetConfig: {
        name: sheet.name,
        rowCount: sheet.rowCount,
        colCount: sheet.colCount,
        frozenRows: sheet.frozenRows,
        frozenCols: sheet.frozenCols,
        defaultRowHeight: sheet.defaultRowHeight,
        defaultColWidth: sheet.defaultColWidth,
      },
      cells: sheet.cells.map(cell => ({
        row: cell.row,
        col: cell.col,
        value: cell.value,
        formula: cell.formula,
        format: cell.format,
      })),
      rowMeta: sheet.rowMeta.map(rm => ({
        row: rm.row,
        height: rm.height,
        hidden: rm.hidden,
      })),
      colMeta: sheet.colMeta.map(cm => ({
        col: cm.col,
        width: cm.width,
        hidden: cm.hidden,
      })),
      conditionalRules: sheet.conditionalRules.map(rule => ({
        name: rule.name,
        priority: rule.priority,
        ranges: rule.ranges,
        conditions: rule.conditions,
        format: rule.format,
        active: rule.active,
      })),
    };

    return this.prisma.template.create({
      data: {
        name: templateName,
        description,
        category: category || 'Custom',
        data: templateData,
        isPublic: false,
      },
    });
  }

  /**
   * Clone a sheet using a template
   */
  async cloneSheetWithTemplate(
    userId: string,
    templateId: string,
    targetSpreadsheetId: string,
    newSheetName?: string,
    options: CloneOptions = {},
  ) {
    const {
      includeData = true,
      includeFormulas = true,
      includeFormatting = true,
      includeConditionalRules = true,
    } = options;

    // Get template
    const template = await this.findOne(templateId);
    const templateData = template.data as any;

    // Check access to target spreadsheet
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: targetSpreadsheetId },
      include: {
        sheets: { select: { index: true } },
        permissions: { where: { userId } },
      },
    });

    if (!spreadsheet) {
      throw new NotFoundException('Spreadsheet not found');
    }

    const isOwner = spreadsheet.ownerId === userId;
    const hasEditorAccess = spreadsheet.permissions.some(
      p => p.role === 'OWNER' || p.role === 'EDITOR',
    );

    if (!isOwner && !hasEditorAccess) {
      throw new ForbiddenException('No edit access to this spreadsheet');
    }

    // Calculate next sheet index
    const maxIndex = spreadsheet.sheets.reduce(
      (max, s) => Math.max(max, s.index),
      -1,
    );

    // Create the new sheet
    const sheetConfig = templateData.sheetConfig || {};
    const newSheet = await this.prisma.sheet.create({
      data: {
        spreadsheetId: targetSpreadsheetId,
        name: newSheetName || sheetConfig.name || `${template.name} Copy`,
        index: maxIndex + 1,
        rowCount: sheetConfig.rowCount || 1000,
        colCount: sheetConfig.colCount || 26,
        frozenRows: sheetConfig.frozenRows || 0,
        frozenCols: sheetConfig.frozenCols || 0,
        defaultRowHeight: sheetConfig.defaultRowHeight || 25,
        defaultColWidth: sheetConfig.defaultColWidth || 100,
      },
    });

    // Clone cells
    if (templateData.cells && (includeData || includeFormulas || includeFormatting)) {
      const cellsToCreate = templateData.cells
        .filter((cell: any) => {
          if (!includeData && !includeFormulas && !includeFormatting) return false;
          return true;
        })
        .map((cell: any) => ({
          sheetId: newSheet.id,
          row: cell.row,
          col: cell.col,
          value: includeData ? cell.value : null,
          formula: includeFormulas ? cell.formula : null,
          format: includeFormatting ? cell.format : null,
        }));

      if (cellsToCreate.length > 0) {
        await this.prisma.cell.createMany({ data: cellsToCreate });
      }
    }

    // Clone row metadata
    if (templateData.rowMeta && templateData.rowMeta.length > 0) {
      await this.prisma.rowMeta.createMany({
        data: templateData.rowMeta.map((rm: any) => ({
          sheetId: newSheet.id,
          row: rm.row,
          height: rm.height,
          hidden: rm.hidden,
        })),
      });
    }

    // Clone column metadata
    if (templateData.colMeta && templateData.colMeta.length > 0) {
      await this.prisma.colMeta.createMany({
        data: templateData.colMeta.map((cm: any) => ({
          sheetId: newSheet.id,
          col: cm.col,
          width: cm.width,
          hidden: cm.hidden,
        })),
      });
    }

    // Clone conditional rules
    if (includeConditionalRules && templateData.conditionalRules && templateData.conditionalRules.length > 0) {
      await this.prisma.conditionalRule.createMany({
        data: templateData.conditionalRules.map((rule: any) => ({
          sheetId: newSheet.id,
          name: rule.name,
          priority: rule.priority,
          ranges: rule.ranges,
          conditions: rule.conditions,
          format: rule.format,
          active: rule.active,
        })),
      });
    }

    return this.prisma.sheet.findUnique({
      where: { id: newSheet.id },
      include: {
        cells: true,
        rowMeta: true,
        colMeta: true,
        conditionalRules: true,
      },
    });
  }

  /**
   * Quick clone: clone a sheet directly to another spreadsheet without saving as template
   */
  async quickCloneSheet(
    userId: string,
    sourceSheetId: string,
    targetSpreadsheetId: string,
    newSheetName?: string,
    options: CloneOptions = {},
  ) {
    // Create a temporary template
    const template = await this.createSnapshotFromSheet(
      userId,
      sourceSheetId,
      'Temporary Clone',
    );

    try {
      // Clone using the template
      const newSheet = await this.cloneSheetWithTemplate(
        userId,
        template.id,
        targetSpreadsheetId,
        newSheetName,
        options,
      );

      // Delete the temporary template
      await this.prisma.template.delete({ where: { id: template.id } });

      return newSheet;
    } catch (error) {
      // Clean up template on error
      await this.prisma.template.delete({ where: { id: template.id } }).catch(() => { });
      throw error;
    }
  }
}
