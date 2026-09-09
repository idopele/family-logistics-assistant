export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped' | 'cancelled';

export interface NotificationDelivery {
  id: string;
  reminderId: string;
  eventId: string;
  occurrenceDate: string;
  subscriptionId: string;
  scheduledForUtc: string;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  lastError?: string | null;
}
