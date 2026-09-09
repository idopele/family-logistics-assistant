export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
  deviceLabel?: string | null;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  failureCount: number;
}
