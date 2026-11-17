import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationEmailContent,
  buildRawMimeEmail,
  encodeMimeSubject,
  formatEventLabel,
  sanitizeHeaderValue,
} from './gmailPayload';

function decodeBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

test('sanitizeHeaderValue strips CR/LF to prevent email header injection', () => {
  assert.equal(sanitizeHeaderValue("Hello\r\nBcc: evil@attacker.com"), 'Hello Bcc: evil@attacker.com');
});

test('buildNotificationEmailContent formats subject, text, and escaped HTML targeting thecontinental.dhpc@gmail.com', () => {
  const content = buildNotificationEmailContent({
    eventType: 'newsletter_subscribe',
    subject: 'New Subscriber — THE CONTINENTAL',
    message: 'reader@example.com subscribed to morning dispatch.\n<script>xss()</script>',
    actorName: 'Reader One',
    actorEmail: 'reader@example.com',
    createdAt: '2026-11-16T12:00:00.000Z',
  });

  assert.equal(formatEventLabel('newsletter_subscribe'), 'Newsletter Subscription');
  assert.match(content.text, /Recipient Inbox: thecontinental\.dhpc@gmail\.com/);
  assert.ok(!content.html.includes('<script>xss()'));
  assert.ok(content.html.includes('&lt;script&gt;xss()&lt;/script&gt;'));
  assert.match(content.html, /Delivered directly to thecontinental\.dhpc@gmail\.com/);
});

test('buildRawMimeEmail constructs valid RFC-2822 multipart MIME encoded as base64url', () => {
  const raw = buildRawMimeEmail({
    to: 'thecontinental.dhpc@gmail.com',
    from: 'THE CONTINENTAL <thecontinental.dhpc@gmail.com>',
    subject: 'Alert: New Submission — “Test”',
    text: 'Plain text body',
    html: '<p>HTML body</p>',
  });

  assert.ok(!raw.includes('+'));
  assert.ok(!raw.includes('/'));
  assert.ok(!raw.includes('='));

  const decoded = decodeBase64Url(raw);
  assert.match(decoded, /^From: THE CONTINENTAL <thecontinental\.dhpc@gmail\.com>/m);
  assert.match(decoded, /^To: thecontinental\.dhpc@gmail\.com/m);
  assert.match(decoded, new RegExp(`^Subject: ${encodeMimeSubject('Alert: New Submission — “Test”').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
  assert.match(decoded, /Content-Type: multipart\/alternative; boundary="tc_alt_boundary_2027"/);
  assert.match(decoded, /Plain text body/);
  assert.match(decoded, /<p>HTML body<\/p>/);
});
