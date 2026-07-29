// apps/api/src/application/research/queries/list-notifications.handler.ts
// Query handler: ListNotifications — unread + recent notifications for a study.

import { Injectable, Inject } from '@nestjs/common';
import { StudyNotification } from '@/domain/research/study-notification.entity';
import type { IStudyNotificationRepository } from '@/domain/research/ports/study-notification.repository.interface';

export interface ListNotificationsCommand {
  studyId: string;
  organizationId: string;
  userId: string;
}

export interface ListNotificationsResult {
  notifications: StudyNotification[];
  unreadCount: number;
}

@Injectable()
export class ListNotificationsHandler {
  constructor(
    @Inject('IStudyNotificationRepository') private readonly notifRepo: IStudyNotificationRepository,
  ) {}

  async execute(cmd: ListNotificationsCommand): Promise<ListNotificationsResult> {
    const [notifications, unreadCount] = await Promise.all([
      this.notifRepo.findByStudy(cmd.studyId, cmd.organizationId),
      this.notifRepo.countUnread(cmd.studyId, cmd.userId),
    ]);
    return { notifications, unreadCount };
  }

  async markAllRead(studyId: string, userId: string): Promise<number> {
    return this.notifRepo.markAllAsReadForStudy(studyId, userId);
  }
}