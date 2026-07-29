// apps/api/src/domain/research/ports/study-notification.repository.interface.ts
// Port: IStudyNotificationRepository — persistence for StudyNotification.

import type { StudyNotification } from '../study-notification.entity';

export interface IStudyNotificationRepository {
  create(notification: StudyNotification): Promise<StudyNotification>;
  findByStudyAndUser(
    studyId: string,
    userId: string,
  ): Promise<StudyNotification[]>;
  findByStudy(
    studyId: string,
    organizationId: string,
  ): Promise<StudyNotification[]>;
  /** Unread count across a study for badge rendering. */
  countUnread(studyId: string, userId: string): Promise<number>;
  markAsRead(id: string): Promise<StudyNotification | null>;
  markAllAsReadForStudy(studyId: string, userId: string): Promise<number>;
}