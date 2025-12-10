import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmbedService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * 임베딩 토큰으로 시트 데이터 조회 (공개 API)
     */
    async getEmbeddedSheet(token: string, referer?: string) {
        const embedConfig = await this.prisma.embedConfig.findUnique({
            where: { embedToken: token },
            include: {
                spreadsheet: {
                    include: {
                        sheets: {
                            orderBy: { index: 'asc' },
                            include: {
                                cells: true,
                                rowMeta: true,
                                colMeta: true,
                                charts: true,
                                pivotTables: true,
                            },
                        },
                        owner: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        if (!embedConfig) {
            throw new NotFoundException('Embed not found');
        }

        if (!embedConfig.enabled) {
            throw new ForbiddenException('Embedding is disabled for this spreadsheet');
        }

        // 도메인 제한 검증
        if (embedConfig.allowedDomains.length > 0 && referer) {
            try {
                const refererUrl = new URL(referer);
                const isAllowed = embedConfig.allowedDomains.some(
                    (domain: string) => refererUrl.hostname === domain || refererUrl.hostname.endsWith(`.${domain}`)
                );
                if (!isAllowed) {
                    throw new ForbiddenException('Domain not allowed for embedding');
                }
            } catch (e) {
                if (e instanceof ForbiddenException) throw e;
                // URL 파싱 실패 시 무시
            }
        }

        return {
            spreadsheet: embedConfig.spreadsheet,
            options: {
                showToolbar: embedConfig.showToolbar,
                showTabs: embedConfig.showTabs,
                showGridlines: embedConfig.showGridlines,
            },
        };
    }

    /**
     * 임베딩 설정 조회
     */
    async getEmbedConfig(userId: string, spreadsheetId: string) {
        const spreadsheet = await this.prisma.spreadsheet.findUnique({
            where: { id: spreadsheetId },
            include: { embedConfig: true },
        });

        if (!spreadsheet) {
            throw new NotFoundException('Spreadsheet not found');
        }

        if (spreadsheet.ownerId !== userId) {
            throw new ForbiddenException('Only owner can manage embed settings');
        }

        return spreadsheet.embedConfig;
    }

    /**
     * 임베딩 설정 생성/업데이트
     */
    async createOrUpdateEmbedConfig(
        userId: string,
        spreadsheetId: string,
        config: {
            enabled?: boolean;
            showToolbar?: boolean;
            showTabs?: boolean;
            showGridlines?: boolean;
            allowedDomains?: string[];
        }
    ) {
        const spreadsheet = await this.prisma.spreadsheet.findUnique({
            where: { id: spreadsheetId },
        });

        if (!spreadsheet) {
            throw new NotFoundException('Spreadsheet not found');
        }

        if (spreadsheet.ownerId !== userId) {
            throw new ForbiddenException('Only owner can manage embed settings');
        }

        const embedConfig = await this.prisma.embedConfig.upsert({
            where: { spreadsheetId },
            create: {
                spreadsheetId,
                ...config,
            },
            update: config,
        });

        return embedConfig;
    }

    /**
     * 임베딩 비활성화 (설정 삭제)
     */
    async deleteEmbedConfig(userId: string, spreadsheetId: string) {
        const spreadsheet = await this.prisma.spreadsheet.findUnique({
            where: { id: spreadsheetId },
        });

        if (!spreadsheet) {
            throw new NotFoundException('Spreadsheet not found');
        }

        if (spreadsheet.ownerId !== userId) {
            throw new ForbiddenException('Only owner can manage embed settings');
        }

        await this.prisma.embedConfig.deleteMany({
            where: { spreadsheetId },
        });

        return { success: true };
    }

    /**
     * 임베딩 토큰 재생성
     */
    async regenerateToken(userId: string, spreadsheetId: string) {
        const spreadsheet = await this.prisma.spreadsheet.findUnique({
            where: { id: spreadsheetId },
        });

        if (!spreadsheet) {
            throw new NotFoundException('Spreadsheet not found');
        }

        if (spreadsheet.ownerId !== userId) {
            throw new ForbiddenException('Only owner can manage embed settings');
        }

        const embedConfig = await this.prisma.embedConfig.update({
            where: { spreadsheetId },
            data: {
                embedToken: crypto.randomUUID(),
            },
        });

        return embedConfig;
    }
}
