import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum NotificationType {
  COMMENT = 'comment',
  MENTION = 'mention',
  SHARE = 'share',
  EDIT = 'edit',
  VERSION = 'version',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  
  // In-memory storage for demo (use Redis or DB in production)
  private notifications: Map<string, Notification[]> = new Map();
  private pushSubscriptions: Map<string, any> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  // Create a notification
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
  ): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomUUID(),
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: new Date(),
    };

    const userNotifications = this.notifications.get(userId) ?? [];
    userNotifications.unshift(notification);
    this.notifications.set(userId, userNotifications.slice(0, 100)); // Keep last 100

    return notification;
  }

  // Get user's notifications
  async getNotifications(userId: string, limit = 20): Promise<Notification[]> {
    const notifications = this.notifications.get(userId) ?? [];
    return notifications.slice(0, limit);
  }

  // Mark notification as read
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notifications = this.notifications.get(userId) ?? [];
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  // Mark all as read
  async markAllAsRead(userId: string): Promise<void> {
    const notifications = this.notifications.get(userId) ?? [];
    notifications.forEach(n => n.read = true);
  }

  // Delete notification
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notifications = this.notifications.get(userId) ?? [];
    const index = notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      notifications.splice(index, 1);
    }
  }

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = this.notifications.get(userId) ?? [];
    return notifications.filter(n => !n.read).length;
  }

  // Register push subscription
  async registerPushSubscription(userId: string, subscription: any): Promise<void> {
    this.pushSubscriptions.set(userId, subscription);
  }

  // Send push notification
  async sendPushNotification(userId: string, title: string, body: string, data?: any): Promise<boolean> {
    const subscription = this.pushSubscriptions.get(userId);
    if (!subscription) return false;

    try {
      // In production, use web-push library
      // await webpush.sendNotification(subscription, JSON.stringify({ title, body, data }));
      this.logger.log(`Push notification sent to ${userId}: ${title}`);
      return true;
    } catch (error) {
      this.logger.error(`Push notification failed for ${userId}:`, error);
      return false;
    }
  }

  // Send notifications for specific events
  async notifyComment(spreadsheetId: string, commentAuthorId: string, content: string): Promise<void> {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: {
        permissions: {
          include: { user: true },
        },
      },
    });

    if (!spreadsheet) return;

    // Notify all users with access except the author
    const usersToNotify = [
      spreadsheet.ownerId,
      ...spreadsheet.permissions.map((p: { userId: string | null }) => p.userId).filter(Boolean),
    ].filter(id => id !== commentAuthorId) as string[];

    for (const userId of new Set(usersToNotify)) {
      await this.createNotification(
        userId,
        NotificationType.COMMENT,
        '새 댓글',
        content.substring(0, 100),
        { spreadsheetId },
      );
    }
  }

  async notifyShare(spreadsheetId: string, sharedWithUserId: string, role: string): Promise<void> {
    const spreadsheet = await this.prisma.spreadsheet.findUnique({
      where: { id: spreadsheetId },
      include: { owner: true },
    });

    if (!spreadsheet) return;

    await this.createNotification(
      sharedWithUserId,
      NotificationType.SHARE,
      '스프레드시트 공유됨',
      `${spreadsheet.owner.name || spreadsheet.owner.email}님이 "${spreadsheet.name}"을(를) 공유했습니다.`,
      { spreadsheetId, role },
    );
  }

  async notifyMention(
    spreadsheetId: string,
    mentionedUserId: string,
    mentionerName: string,
  ): Promise<void> {
    await this.createNotification(
      mentionedUserId,
      NotificationType.MENTION,
      '멘션됨',
      `${mentionerName}님이 댓글에서 회원님을 멘션했습니다.`,
      { spreadsheetId },
    );
  }
}
