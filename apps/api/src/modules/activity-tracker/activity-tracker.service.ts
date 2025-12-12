import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface StartSessionDto {
    spreadsheetId: string;
    sheetId?: string;
    sessionType?: string;
}

export interface ActivitySummary {
    spreadsheetId: string;
    spreadsheetName?: string;
    activeSessions: number;
    recentEditors: { userId: string; userName?: string; lastActive: Date }[];
    totalEdits24h: number;
    totalViews24h: number;
}

@Injectable()
export class ActivityTrackerService {
    constructor(private readonly prisma: PrismaService) { }

    async startSession(userId: string, dto: StartSessionDto): Promise<any> {
        // End any existing active sessions for this user on this spreadsheet
        await (this.prisma as any).sheetSession.updateMany({
            where: {
                userId,
                spreadsheetId: dto.spreadsheetId,
                endedAt: null,
            },

            data: {
                endedAt: new Date(),
            },
        });

        return (this.prisma as any).sheetSession.create({
            data: {
                userId,
                spreadsheetId: dto.spreadsheetId,
                sheetId: dto.sheetId,
                sessionType: dto.sessionType || 'EDIT',
            },
        });
    }

    async updateActivity(sessionId: string): Promise<any> {
        return (this.prisma as any).sheetSession.update({
            where: { id: sessionId },
            data: {
                lastActiveAt: new Date(),
            },
        });
    }

    async recordEdit(sessionId: string): Promise<any> {
        return (this.prisma as any).sheetSession.update({
            where: { id: sessionId },
            data: {
                lastActiveAt: new Date(),
                editCount: { increment: 1 },
            },
        });
    }

    async recordView(sessionId: string): Promise<any> {
        return (this.prisma as any).sheetSession.update({
            where: { id: sessionId },
            data: {
                lastActiveAt: new Date(),
                viewCount: { increment: 1 },
            },
        });
    }

    async endSession(sessionId: string): Promise<any> {
        return (this.prisma as any).sheetSession.update({
            where: { id: sessionId },
            data: {
                endedAt: new Date(),
            },
        });
    }

    async getActiveSessions(spreadsheetId?: string): Promise<any[]> {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        return (this.prisma as any).sheetSession.findMany({
            where: {
                spreadsheetId,
                endedAt: null,
                lastActiveAt: { gte: fifteenMinutesAgo },
            },
            orderBy: { lastActiveAt: 'desc' },
        });
    }

    async getActiveSessionsWithUsers(spreadsheetId?: string): Promise<any[]> {
        const sessions = await this.getActiveSessions(spreadsheetId);

        const enriched = await Promise.all(
            sessions.map(async (session) => {
                const user = await this.prisma.user.findUnique({
                    where: { id: session.userId },
                    select: { email: true, name: true, avatar: true },
                });
                const spreadsheet = await this.prisma.spreadsheet.findUnique({
                    where: { id: session.spreadsheetId },
                    select: { name: true },
                });
                return {
                    ...session,
                    user,
                    spreadsheetName: spreadsheet?.name,
                };
            })
        );

        return enriched;
    }

    async getSpreadsheetActivity(spreadsheetId: string): Promise<ActivitySummary> {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const [activeSessions, recentSessions, spreadsheet] = await Promise.all([
            (this.prisma as any).sheetSession.findMany({
                where: {
                    spreadsheetId,
                    endedAt: null,
                    lastActiveAt: { gte: fifteenMinutesAgo },
                },
            }),
            (this.prisma as any).sheetSession.findMany({
                where: {
                    spreadsheetId,
                    lastActiveAt: { gte: oneDayAgo },
                },
            }),
            this.prisma.spreadsheet.findUnique({
                where: { id: spreadsheetId },
                select: { name: true },
            }),
        ]);

        // Get unique recent editors
        const editorMap = new Map<string, { userId: string; lastActive: Date }>();
        for (const session of (recentSessions as any[]).filter((s: any) => s.sessionType === 'EDIT' || s.editCount > 0)) {
            const existing = editorMap.get(session.userId);
            if (!existing || session.lastActiveAt > existing.lastActive) {
                editorMap.set(session.userId, {
                    userId: session.userId,
                    lastActive: session.lastActiveAt,
                });
            }
        }


        const recentEditors = await Promise.all(
            Array.from(editorMap.values()).slice(0, 10).map(async (editor) => {
                const user = await this.prisma.user.findUnique({
                    where: { id: editor.userId },
                    select: { name: true },
                });
                return {
                    userId: editor.userId,
                    userName: user?.name ?? undefined,
                    lastActive: editor.lastActive,
                };
            })

        );

        const totalEdits24h = (recentSessions as any[]).reduce((sum: number, s: any) => sum + s.editCount, 0);
        const totalViews24h = (recentSessions as any[]).reduce((sum: number, s: any) => sum + s.viewCount, 0);


        return {
            spreadsheetId,
            spreadsheetName: spreadsheet?.name,
            activeSessions: activeSessions.length,
            recentEditors,
            totalEdits24h,
            totalViews24h,
        };
    }

    async getAllSpreadsheetActivity(): Promise<ActivitySummary[]> {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        // Get all spreadsheets with recent activity
        const activeSpreadsheetIds = await (this.prisma as any).sheetSession.findMany({
            where: {
                lastActiveAt: { gte: fifteenMinutesAgo },
            },
            select: { spreadsheetId: true },
            distinct: ['spreadsheetId'],
        });

        return Promise.all(
            activeSpreadsheetIds.map((s: any) => this.getSpreadsheetActivity(s.spreadsheetId))
        );

    }

    async cleanupStaleSessions(): Promise<number> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const result = await (this.prisma as any).sheetSession.updateMany({
            where: {
                endedAt: null,
                lastActiveAt: { lt: oneHourAgo },
            },
            data: {
                endedAt: new Date(),
            },
        });

        return result.count;
    }

    async getUserActivity(userId: string, days: number = 7): Promise<any> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const sessions = await (this.prisma as any).sheetSession.findMany({
            where: {
                userId,
                startedAt: { gte: since },
            },
            orderBy: { startedAt: 'desc' },
        });

        const totalEdits = (sessions as any[]).reduce((sum: number, s: any) => sum + s.editCount, 0);
        const totalViews = (sessions as any[]).reduce((sum: number, s: any) => sum + s.viewCount, 0);
        const uniqueSpreadsheets = new Set((sessions as any[]).map((s: any) => s.spreadsheetId)).size;


        return {
            userId,
            totalSessions: sessions.length,
            totalEdits,
            totalViews,
            uniqueSpreadsheets,
            recentSessions: sessions.slice(0, 20),
        };
    }
}

