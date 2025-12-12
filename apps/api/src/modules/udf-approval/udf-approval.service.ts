import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UDFApproval, UDFApprovalStatus, RiskLevel, Prisma } from '@prisma/client';

// Dangerous code patterns
const DANGEROUS_PATTERNS = [
    { pattern: /eval\s*\(/g, risk: 'CRITICAL', message: 'Use of eval() is not allowed' },
    { pattern: /Function\s*\(/g, risk: 'CRITICAL', message: 'Dynamic function creation not allowed' },
    { pattern: /import\s*\(/g, risk: 'HIGH', message: 'Dynamic imports not allowed' },
    { pattern: /require\s*\(/g, risk: 'CRITICAL', message: 'require() is not allowed' },
    { pattern: /process\./g, risk: 'CRITICAL', message: 'Access to process object not allowed' },
    { pattern: /global\./g, risk: 'HIGH', message: 'Access to global object not allowed' },
    { pattern: /window\./g, risk: 'MEDIUM', message: 'Access to window object' },
    { pattern: /document\./g, risk: 'MEDIUM', message: 'DOM manipulation detected' },
    { pattern: /fetch\s*\(/g, risk: 'HIGH', message: 'Network requests not allowed' },
    { pattern: /XMLHttpRequest/g, risk: 'HIGH', message: 'Network requests not allowed' },
    { pattern: /localStorage/g, risk: 'MEDIUM', message: 'Local storage access detected' },
    { pattern: /sessionStorage/g, risk: 'MEDIUM', message: 'Session storage access detected' },
    { pattern: /while\s*\(\s*true\s*\)/g, risk: 'HIGH', message: 'Infinite loop detected' },
    { pattern: /for\s*\(.*?;\s*;\s*\)/g, risk: 'HIGH', message: 'Infinite loop detected' },
];

export interface CreateUDFApprovalDto {
    spreadsheetId: string;
    name: string;
    description?: string;
    code: string;
    parameters?: any;
}

export interface ReviewUDFDto {
    status: 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
}

export interface RiskAnalysisResult {
    riskLevel: RiskLevel;
    issues: { pattern: string; risk: string; message: string; line?: number }[];
}

@Injectable()
export class UDFApprovalService {
    constructor(private readonly prisma: PrismaService) { }

    async requestApproval(requesterId: string, dto: CreateUDFApprovalDto): Promise<UDFApproval> {
        // Analyze code for risks
        const riskAnalysis = this.analyzeCodeRisk(dto.code);

        return this.prisma.uDFApproval.create({
            data: {
                spreadsheetId: dto.spreadsheetId,
                name: dto.name,
                description: dto.description,
                code: dto.code,
                parameters: dto.parameters as Prisma.InputJsonValue,
                requesterId,
                riskLevel: riskAnalysis.riskLevel,
                riskDetails: riskAnalysis.issues as unknown as Prisma.InputJsonValue,
            },
        });
    }

    async review(id: string, reviewerId: string, dto: ReviewUDFDto): Promise<UDFApproval> {
        const approval = await this.prisma.uDFApproval.findUnique({
            where: { id },
        });

        if (!approval) {
            throw new NotFoundException(`UDF approval request with ID "${id}" not found`);
        }

        if (approval.status !== 'PENDING') {
            throw new BadRequestException('This request has already been reviewed');
        }

        return this.prisma.uDFApproval.update({
            where: { id },
            data: {
                status: dto.status as UDFApprovalStatus,
                reviewerId,
                reviewNotes: dto.reviewNotes,
                reviewedAt: new Date(),
            },
        });
    }

    async revoke(id: string, reviewerId: string, reason?: string): Promise<UDFApproval> {
        const approval = await this.prisma.uDFApproval.findUnique({
            where: { id },
        });

        if (!approval) {
            throw new NotFoundException(`UDF approval request with ID "${id}" not found`);
        }

        return this.prisma.uDFApproval.update({
            where: { id },
            data: {
                status: 'REVOKED',
                reviewerId,
                reviewNotes: reason || 'Approval revoked',
                reviewedAt: new Date(),
            },
        });
    }

    async findAll(status?: UDFApprovalStatus): Promise<UDFApproval[]> {
        const where = status ? { status } : {};
        return this.prisma.uDFApproval.findMany({
            where,
            orderBy: { requestedAt: 'desc' },
        });
    }

    async findPending(): Promise<UDFApproval[]> {
        return this.findAll('PENDING');
    }

    async findOne(id: string): Promise<UDFApproval> {
        const approval = await this.prisma.uDFApproval.findUnique({
            where: { id },
        });

        if (!approval) {
            throw new NotFoundException(`UDF approval request with ID "${id}" not found`);
        }

        return approval;
    }

    async findBySpreadsheet(spreadsheetId: string): Promise<UDFApproval[]> {
        return this.prisma.uDFApproval.findMany({
            where: { spreadsheetId },
            orderBy: { requestedAt: 'desc' },
        });
    }

    async isApproved(spreadsheetId: string, name: string): Promise<boolean> {
        const approval = await this.prisma.uDFApproval.findFirst({
            where: {
                spreadsheetId,
                name,
                status: 'APPROVED',
            },
        });
        return !!approval;
    }

    analyzeCodeRisk(code: string): RiskAnalysisResult {
        const issues: { pattern: string; risk: string; message: string; line?: number }[] = [];
        const lines = code.split('\n');

        for (const check of DANGEROUS_PATTERNS) {
            let match;
            while ((match = check.pattern.exec(code)) !== null) {
                // Find line number
                let charCount = 0;
                let lineNum = 1;
                for (const line of lines) {
                    charCount += line.length + 1;
                    if (charCount > match.index) break;
                    lineNum++;
                }

                issues.push({
                    pattern: match[0],
                    risk: check.risk,
                    message: check.message,
                    line: lineNum,
                });
            }
            // Reset regex lastIndex
            check.pattern.lastIndex = 0;
        }

        // Determine overall risk level
        let riskLevel: RiskLevel = 'LOW';
        if (issues.some(i => i.risk === 'CRITICAL')) {
            riskLevel = 'CRITICAL';
        } else if (issues.some(i => i.risk === 'HIGH')) {
            riskLevel = 'HIGH';
        } else if (issues.some(i => i.risk === 'MEDIUM')) {
            riskLevel = 'MEDIUM';
        }

        return { riskLevel, issues };
    }

    async getStats(): Promise<{ pending: number; approved: number; rejected: number; revoked: number }> {
        const [pending, approved, rejected, revoked] = await Promise.all([
            this.prisma.uDFApproval.count({ where: { status: 'PENDING' } }),
            this.prisma.uDFApproval.count({ where: { status: 'APPROVED' } }),
            this.prisma.uDFApproval.count({ where: { status: 'REJECTED' } }),
            this.prisma.uDFApproval.count({ where: { status: 'REVOKED' } }),
        ]);
        return { pending, approved, rejected, revoked };
    }
}
