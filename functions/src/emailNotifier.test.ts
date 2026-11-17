import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNewsletterSubscribedEmail,
  buildSubmissionReceivedEmail,
  buildUserRegisteredEmail,
  deliverAdminEmailNotification,
  escapeHtml,
  NOTIFICATION_RECIPIENT_EMAIL,
  type EmailMessagePayload,
} from './emailNotifier';

test('buildUserRegisteredEmail targets thecontinental.dhpc@gmail.com and escapes HTML content', () => {
  const payload = buildUserRegisteredEmail({
    uid: 'uid-123',
    email: 'writer@example.com',
    displayName: '<script>alert("xss")</script> Meera',
    providerIds: ['google.com'],
    createdAt: '2026-11-16T08:45:00.000Z',
  });

  assert.equal(payload.to, 'thecontinental.dhpc@gmail.com');
  assert.equal(payload.to, NOTIFICATION_RECIPIENT_EMAIL);
  assert.match(payload.subject, /New User Registration:/);
  assert.match(payload.text, /writer@example\.com/);
  assert.ok(!payload.html.includes('<script>alert'));
  assert.ok(payload.html.includes(escapeHtml('<script>alert("xss")</script>')));
});

test('buildUserRegisteredEmail supports phone-number registration without email', () => {
  const payload = buildUserRegisteredEmail({
    uid: 'uid-phone-1',
    phoneNumber: '+919876543210',
    displayName: 'Phone Reader',
    providerIds: ['phone'],
    createdAt: '2026-11-16T08:45:00.000Z',
  });

  assert.equal(payload.to, 'thecontinental.dhpc@gmail.com');
  assert.equal(payload.actorEmail, '+919876543210');
  assert.match(payload.subject, /\+919876543210/);
  assert.match(payload.text, /Phone: \+919876543210/);
});

test('buildNewsletterSubscribedEmail targets thecontinental.dhpc@gmail.com with no subscription fee', () => {
  const payload = buildNewsletterSubscribedEmail({
    subscriberId: 'sub-abc',
    email: 'Reader@Example.com',
    source: 'sidebar_form',
    subscribedAt: '2026-11-16T08:50:00.000Z',
  });

  assert.equal(payload.to, 'thecontinental.dhpc@gmail.com');
  assert.equal(payload.actorEmail, 'reader@example.com');
  assert.equal(payload.subject, 'New Newsletter Subscriber: reader@example.com');
  assert.ok(!payload.text.includes('Fee'));
  assert.ok(!payload.text.includes('₹1'));
  assert.ok(!payload.html.includes('Subscription Fee'));
  assert.match(payload.text, /sidebar_form/);
});

test('buildSubmissionReceivedEmail targets thecontinental.dhpc@gmail.com and escapes manuscript HTML', () => {
  const payload = buildSubmissionReceivedEmail({
    submissionId: 'TC-SUB-20261116-9999',
    title: 'Parliamentary Oversight & <b>Public</b> Finance',
    authorName: 'Ananya Sharma',
    authorEmail: 'Ananya@Example.com',
    categoryId: 'cat-politics',
    createdAt: '2026-11-16T09:00:00.000Z',
  });

  assert.equal(payload.to, 'thecontinental.dhpc@gmail.com');
  assert.equal(payload.actorEmail, 'ananya@example.com');
  assert.match(payload.subject, /TC-SUB-20261116-9999/);
  assert.match(payload.text, /Ananya Sharma/);
  assert.ok(!payload.html.includes('<b>Public</b>'));
  assert.ok(payload.html.includes(escapeHtml('<b>Public</b>')));
});

test('deliverAdminEmailNotification sends once to thecontinental.dhpc@gmail.com and skips duplicate retries', async () => {
  const store = new Map<string, Record<string, unknown>>();
  const sentEmails: EmailMessagePayload[] = [];

  const mockDb = {
    collection: (name: string) => ({
      doc: (id: string) => ({ key: `${name}/${id}` }),
    }),
    runTransaction: async <T>(fn: (tx: { get: (ref: { key: string }) => Promise<{ exists: boolean }>; set: (ref: { key: string }, data: Record<string, unknown>) => void }) => Promise<T>): Promise<T> => {
      const tx = {
        get: async (ref: { key: string }) => ({ exists: store.has(ref.key) }),
        set: (ref: { key: string }, data: Record<string, unknown>) => {
          store.set(ref.key, data);
        },
      };
      return fn(tx);
    },
  };

  const emailPayload = buildNewsletterSubscribedEmail({
    subscriberId: 'sub-1',
    email: 'reader@example.com',
  });

  const first = await deliverAdminEmailNotification({
    db: mockDb as unknown as Parameters<typeof deliverAdminEmailNotification>[0]['db'],
    notificationId: 'fn_newsletter_sub-1_evt1',
    eventType: 'newsletter_subscribe',
    actorUid: 'newsletter_sub-1',
    actorEmail: emailPayload.actorEmail,
    actorName: emailPayload.actorName,
    subject: emailPayload.subject,
    summaryMessage: emailPayload.summaryMessage,
    emailPayload,
    sender: async (p) => {
      sentEmails.push(p);
      return { sent: true, provider: 'smtp', status: 'emailed_via_smtp' };
    },
  });

  assert.equal(first.skippedDuplicate, false);
  assert.equal(first.delivery.sent, true);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'thecontinental.dhpc@gmail.com');

  const second = await deliverAdminEmailNotification({
    db: mockDb as unknown as Parameters<typeof deliverAdminEmailNotification>[0]['db'],
    notificationId: 'fn_newsletter_sub-1_evt1',
    eventType: 'newsletter_subscribe',
    actorUid: 'newsletter_sub-1',
    actorEmail: emailPayload.actorEmail,
    actorName: emailPayload.actorName,
    subject: emailPayload.subject,
    summaryMessage: emailPayload.summaryMessage,
    emailPayload,
    sender: async (p) => {
      sentEmails.push(p);
      return { sent: true, provider: 'smtp', status: 'emailed_via_smtp' };
    },
  });

  assert.equal(second.skippedDuplicate, true);
  assert.equal(second.delivery.status, 'duplicate_skipped');
  assert.equal(sentEmails.length, 1);
});
