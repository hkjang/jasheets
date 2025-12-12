import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MacroApproval, MacroApprovalStatus, RiskLevel, Prisma } from '@prisma/client';

// Dangerous patterns for macro code
const LINT_RULES = [
    { pattern: /eval\s*\(/g, type: 'error', message: 'eval() is not allowed' },
    { pattern: /Function\s*\(/g, type: 'error', message: 'Dynamic Function constructor not allowed' },
    { pattern: /document\.\s*(write|writeln)/g, type: 'error', message: 'document.write is not allowed' },
    { pattern: /innerHTML\s*=/g, type: 'warning', message: 'innerHTML assignment can be dangerous' },
    { pattern: /outerHTML\s*=/g, type: 'warning', message: 'outerHTML assignment can be dangerous' },
    { pattern: /\.exec\s*\(/g, type: 'warning', message: 'exec() should be used carefully' },
    { pattern: /localStorage\./g, type: 'warning', message: 'localStorage access detected' },
    { pattern: /sessionStorage\./g, type: 'warning', message: 'sessionStorage access detected' },
    { pattern: /fetch\s*\(/g, type: 'warning', message: 'Network requests detected' },
    { pattern: /XMLHttpRequest/g, type: 'warning', message: 'XMLHttpRequest usage detected' },
    { pattern: /while\s*\(\s*true\s*\)/g, type: 'error', message: 'Infinite loop detected' },
    { pattern: /setInterval\s*\(/g, type: 'warning', message: 'setInterval can cause performance issues' },
    { pattern: /setTimeout\s*\(/g, type: 'info', message: 'setTimeout usage detected' },
];

export interface CreateMacroApprovalDto {
    spreadsheetId: string;
    commandId?: string;
    name: string;
    script: string;
    description?: string;
}

export interface ReviewMacroDto {
    status: 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
}

export interface LintResult {
    errors: { line?: number; message: string }[];
    warnings: { line?: number; message: string }[];
    info: { line?: number; message: string }[];
}

@Injectable()
export class MacroApprovalService {
    constructor(private readonly prisma: PrismaService) { }

    async requestApproval(requesterId: string, dto: CreateMacroApprovalDto): Promise<MacroApproval> {
        const lintResults = this.lintCode(dto.script);
        const riskLevel = this.calculateRiskLevel(lintResults);

        return this.prisma.macroApproval.create({
            data: {
                spreadsheetId: dto.spreadsheetId,
                commandId: dto.commandId,
                name: dto.name,
                script: dto.script,
                description: dto.description,
                requesterId,
                lintResults: lintResults as unknown as Prisma.InputJsonValue,
                riskLevel,
            },
        });
    }

    async review(id: string, reviewerId: string, dto: ReviewMacroDto): Promise<MacroApproval> {
        const approval = await this.prisma.macroApproval.findUnique({
            where: { id },
        });

        if (!approval) {
            throw new NotFoundException(`Macro approval request with ID "${id}" not found`);
        }

        if (approval.status !== 'PENDING') {
            throw new BadRequestException('This request has already been reviewed');
        }

        return this.prisma.macroApproval.update({
            where: { id },
            data: {
                status: dto.status as MacroApprovalStatus,
                reviewerId,
                reviewNotes: dto.reviewNotes,
                reviewedAt: new Date(),
            },
        });
    }

    async revoke(id: string, reviewerId: string, reason?: string): Promise<MacroApproval> {
        const approval = await this.prisma.macroApproval.findUnique({
            where: { id },
        });

        if (!approval) {
            throw new NotFoundException(`Macro approval request with ID "${id}" not found`);
        }

        return this.prisma.macroApproval.update({
            where: { id },
            data: {
                status: 'REVOKED',
                reviewerId,
                reviewNotes: reason || 'Approval revoked',
                reviewedAt: new Date(),
            },
        });
    }

    async findAll(status?: MacroApprovalStatus): Promise<MacroApproval[]> {
        const where = status ? { status } : {};
        return this.prisma.macroApproval.findMany({
            where,
            orderBy: { requestedAt: 'desc' },
        });
    }

    async findPending(): Promise<MacroApproval[]> {
        return this.findAll('PENDING');
    }

    async findOne(id: string): Promise<MacroApproval> {
        const approval = await this.prisma.macroApproval.findUnique({
            where: { id },
        });

        if (!approval) {
            throw new NotFoundException(`Macro approval request with ID "${id}" not found`);
        }

        return approval;
    }

    lintCode(code: string): LintResult {
        const errors: { line?: number; message: string }[] = [];
        const warnings: { line?: number; message: string }[] = [];
        const info: { line?: number; message: string }[] = [];
        const lines = code.split('\n');

        for (const rule of LINT_RULES) {
            let match;
            while ((match = rule.pattern.exec(code)) !== null) {
                // Find line number
                let charCount = 0;
                let lineNum = 1;
                for (const line of lines) {
                    charCount += line.length + 1;
                    if (charCount > match.index) break;
                    lineNum++;
                }

                const issue = { line: lineNum, message: rule.message };
                if (rule.type === 'error') errors.push(issue);
                else if (rule.type === 'warning') warnings.push(issue);
                else info.push(issue);
            }
            rule.pattern.lastIndex = 0;
        }

        return { errors, warnings, info };
    }

    calculateRiskLevel(lintResults: LintResult): RiskLevel {
        if (lintResults.errors.length > 3) return 'CRITICAL';
        if (lintResults.errors.length > 0) return 'HIGH';
        if (lintResults.warnings.length > 3) return 'MEDIUM';
        return 'LOW';
    }

    async getStats(): Promise<{ pending: number; approved: number; rejected: number; revoked: number }> {
        const [pending, approved, rejected, revoked] = await Promise.all([
            this.prisma.macroApproval.count({ where: { status: 'PENDING' } }),
            this.prisma.macroApproval.count({ where: { status: 'APPROVED' } }),
            this.prisma.macroApproval.count({ where: { status: 'REJECTED' } }),
            this.prisma.macroApproval.count({ where: { status: 'REVOKED' } }),
        ]);
        return { pending, approved, rejected, revoked };
    }
}
