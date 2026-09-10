import { describe, expect, it, vi } from 'vitest';

import type { Child, Event, EventReminder, PushSubscriptionRecord } from '../../../src/models';
import type { WebPushSendResult } from '../../../src/services/webPush';
import { buildDeliveryId, processDueNotifications } from '../src';

const child: Child = { id: 'worker-child', name: 'Daniel', color: '#2563EB', isActive: true };
const event: Event = {
  id: 'worker-event',
  childId: child.id,
  title: 'Doctor',
  category: 'doctor',
  customCategoryLabel: null,
  date: '2026-09-09',
  startTime: '17:30',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const reminder: EventReminder = {
  id: 'worker-reminder',
  eventId: event.id,
  occurrenceDate: '2026-09-09',
  reminderMinutesBefore: 30,
  enabled: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const config = {
  vapidPublicKey: 'public',
  vapidPrivateKey: 'private',
  vapidSubject: 'mailto:test@example.com',
};

describe('push scheduler Worker delivery idempotency', () => {
  it('first Cron run sends and second Cron run does not resend the same successful delivery', async () => {
    const db = new FakeD1Database({ subscriptions: [subscription('push-one')], children: [child], events: [event], reminders: [reminder] });
    const sendPush = vi.fn(async (): Promise<WebPushSendResult> => ({ ok: true, status: 201, permanentFailure: false }));

    expect((await runScheduler(db, sendPush)).sent).toBe(1);
    expect((await runScheduler(db, sendPush)).skipped).toBe(1);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it('sends one notification per enabled device', async () => {
    const db = new FakeD1Database({
      subscriptions: [subscription('push-one'), subscription('push-two')],
      children: [child],
      events: [event],
      reminders: [reminder],
    });
    const sendPush = vi.fn(async (): Promise<WebPushSendResult> => ({ ok: true, status: 201, permanentFailure: false }));

    const summary = await runScheduler(db, sendPush);

    expect(summary.sent).toBe(2);
    expect(sendPush).toHaveBeenCalledTimes(2);
  });

  it('permanent invalid push responses disable the subscription', async () => {
    const db = new FakeD1Database({ subscriptions: [subscription('push-one')], children: [child], events: [event], reminders: [reminder] });
    const sendPush = vi.fn(async (): Promise<WebPushSendResult> => ({
      ok: false,
      status: 410,
      permanentFailure: true,
      error: 'gone',
    }));

    const summary = await runScheduler(db, sendPush);

    expect(summary.invalidSubscriptionsDisabled).toBe(1);
    expect(db.subscriptions[0]?.enabled).toBe(0);
  });

  it('temporary failures increment failure state and do not retry after the maximum attempts', async () => {
    const db = new FakeD1Database({ subscriptions: [subscription('push-one')], children: [child], events: [event], reminders: [reminder] });
    const sendPush = vi.fn(async (): Promise<WebPushSendResult> => ({
      ok: false,
      status: 503,
      permanentFailure: false,
      error: 'temporary',
    }));

    await runScheduler(db, sendPush);
    await runScheduler(db, sendPush);
    await runScheduler(db, sendPush);
    const finalSummary = await runScheduler(db, sendPush);

    expect(db.subscriptions[0]?.failure_count).toBe(3);
    expect(sendPush).toHaveBeenCalledTimes(3);
    expect(sendPush.mock.calls.map((call) => call[1].tag)).toEqual([
      sendPush.mock.calls[0]?.[1].tag,
      sendPush.mock.calls[0]?.[1].tag,
      sendPush.mock.calls[0]?.[1].tag,
    ]);
    expect(finalSummary.skipped).toBe(1);
  });

  it('keeps D1 delivery uniqueness based on reminder, subscription, and scheduled time', () => {
    const firstDeliveryId = buildDeliveryId(reminder.id, 'push-one', '2026-09-09T14:00:00.000Z');
    const retryDeliveryId = buildDeliveryId(reminder.id, 'push-one', '2026-09-09T14:00:00.000Z');
    const rescheduledDeliveryId = buildDeliveryId(reminder.id, 'push-one', '2026-09-09T15:00:00.000Z');

    expect(retryDeliveryId).toBe(firstDeliveryId);
    expect(rescheduledDeliveryId).not.toBe(firstDeliveryId);
  });
});

async function runScheduler(db: FakeD1Database, sendPush: Parameters<typeof processDueNotifications>[0]['sendPush']) {
  return processDueNotifications({
    db,
    config,
    nowUtc: '2026-09-09T14:00:00.000Z',
    timeZone: 'Asia/Jerusalem',
    language: 'en',
    sendPush,
  });
}

function subscription(id: string): PushSubscriptionRow {
  return {
    id,
    endpoint: `https://push.example.test/${id}`,
    p256dh: 'p256dh',
    auth: 'auth',
    enabled: 1,
    device_label: null,
    user_agent: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    last_success_at: null,
    last_failure_at: null,
    failure_count: 0,
  };
}

type D1Value = string | number | null;

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: number;
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
}

interface DeliveryRow {
  id: string;
  reminder_id: string;
  event_id: string;
  occurrence_date: string;
  subscription_id: string;
  scheduled_for_utc: string;
  status: string;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  last_error: string | null;
}

class FakeD1Database {
  subscriptions: PushSubscriptionRow[];
  deliveries: DeliveryRow[] = [];
  private readonly children: Child[];
  private readonly events: Event[];
  private readonly reminders: EventReminder[];

  constructor({
    subscriptions,
    children,
    events,
    reminders,
  }: {
    subscriptions: PushSubscriptionRow[];
    children: Child[];
    events: Event[];
    reminders: EventReminder[];
  }) {
    this.subscriptions = subscriptions;
    this.children = children;
    this.events = events;
    this.reminders = reminders;
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this, query);
  }

  all(query: string) {
    if (query.includes('FROM custom_children')) {
      return this.children.map((item) => ({ payload: JSON.stringify(item) }));
    }

    if (query.includes('FROM custom_events')) {
      return this.events.map((item) => ({ payload: JSON.stringify(item) }));
    }

    if (query.includes('FROM event_exceptions')) {
      return [];
    }

    if (query.includes('FROM event_reminders')) {
      return this.reminders.map((item) => ({
        id: item.id,
        event_id: item.eventId,
        occurrence_date: item.occurrenceDate,
        minutes_before: item.reminderMinutesBefore,
        enabled: item.enabled ? 1 : 0,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      }));
    }

    if (query.includes('FROM push_subscriptions')) {
      return this.subscriptions.filter((item) => item.enabled === 1);
    }

    return [];
  }

  first(query: string, values: D1Value[]) {
    if (query.includes('FROM notification_deliveries')) {
      return this.deliveries.find((item) => item.id === values[0]) ?? null;
    }

    return null;
  }

  run(query: string, values: D1Value[]) {
    if (query.startsWith('INSERT OR IGNORE INTO notification_deliveries')) {
      const existing = this.deliveries.some((item) => item.id === values[0]);

      if (!existing) {
        this.deliveries.push({
          id: String(values[0]),
          reminder_id: String(values[1]),
          event_id: String(values[2]),
          occurrence_date: String(values[3]),
          subscription_id: String(values[4]),
          scheduled_for_utc: String(values[5]),
          status: String(values[6]),
          attempt_count: Number(values[7]),
          created_at: String(values[8]),
          updated_at: String(values[9]),
          sent_at: null,
          last_error: null,
        });
      }
    }

    if (query.startsWith('UPDATE notification_deliveries SET status = ?, attempt_count')) {
      this.updateDelivery(String(values[2]), (delivery) => {
        delivery.status = String(values[0]);
        delivery.attempt_count += 1;
        delivery.updated_at = String(values[1]);
      });
    }

    if (query.startsWith('UPDATE notification_deliveries SET status = ?, sent_at')) {
      this.updateDelivery(String(values[3]), (delivery) => {
        delivery.status = String(values[0]);
        delivery.sent_at = String(values[1]);
        delivery.updated_at = String(values[2]);
        delivery.last_error = null;
      });
    }

    if (query.startsWith('UPDATE notification_deliveries SET status = ?, updated_at')) {
      this.updateDelivery(String(values[3]), (delivery) => {
        delivery.status = String(values[0]);
        delivery.updated_at = String(values[1]);
        delivery.last_error = String(values[2]);
      });
    }

    if (query.startsWith('UPDATE push_subscriptions SET last_success_at')) {
      this.updateSubscription(String(values[2]), (subscriptionRow) => {
        subscriptionRow.last_success_at = String(values[0]);
        subscriptionRow.last_failure_at = null;
        subscriptionRow.failure_count = 0;
        subscriptionRow.updated_at = String(values[1]);
      });
    }

    if (query.startsWith('UPDATE push_subscriptions SET enabled = 0')) {
      this.updateSubscription(String(values[2]), (subscriptionRow) => {
        subscriptionRow.enabled = 0;
        subscriptionRow.last_failure_at = String(values[0]);
        subscriptionRow.failure_count += 1;
        subscriptionRow.updated_at = String(values[1]);
      });
    }

    if (query.startsWith('UPDATE push_subscriptions SET last_failure_at')) {
      this.updateSubscription(String(values[2]), (subscriptionRow) => {
        subscriptionRow.last_failure_at = String(values[0]);
        subscriptionRow.failure_count += 1;
        subscriptionRow.updated_at = String(values[1]);
      });
    }

    return { meta: { changes: 1 } };
  }

  private updateDelivery(id: string, updater: (delivery: DeliveryRow) => void) {
    const delivery = this.deliveries.find((item) => item.id === id);

    if (delivery !== undefined) {
      updater(delivery);
    }
  }

  private updateSubscription(id: string, updater: (subscriptionRow: PushSubscriptionRow) => void) {
    const subscriptionRow = this.subscriptions.find((item) => item.id === id);

    if (subscriptionRow !== undefined) {
      updater(subscriptionRow);
    }
  }
}

class FakeD1PreparedStatement {
  private values: D1Value[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly query: string,
  ) {}

  bind(...values: D1Value[]) {
    this.values = values;

    return this;
  }

  async all<T>() {
    return { results: this.db.all(this.query) as T[] };
  }

  async first<T>() {
    return this.db.first(this.query, this.values) as T | null;
  }

  async run() {
    return this.db.run(this.query, this.values);
  }
}
