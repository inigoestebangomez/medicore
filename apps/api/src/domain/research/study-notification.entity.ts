// apps/api/src/domain/research/study-notification.entity.ts
// Domain entity: StudyNotification (M8). In-app notification surfaced when a
// study's live cohort changes after an import completion (BR-RES-008).

export interface StudyNotificationProps {
  id: string;
  studyId: string;
  organizationId: string;
  userId: string;
  newPatientCount?: number;
  readAt?: Date | null;
  createdAt?: Date;
}

export class StudyNotification {
  readonly id: string;
  readonly studyId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly newPatientCount: number;
  readonly readAt: Date | null;
  readonly createdAt: Date;

  constructor(props: StudyNotificationProps) {
    this.id = props.id;
    this.studyId = props.studyId;
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.newPatientCount = props.newPatientCount ?? 0;
    this.readAt = props.readAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }

  get isRead(): boolean {
    return this.readAt !== null;
  }

  markAsRead(): StudyNotification {
    if (this.isRead) return this; // idempotent
    return new StudyNotification({
      ...this,
      readAt: new Date(),
    });
  }
}