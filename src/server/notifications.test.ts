import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveNotificationRecipient,
  sendNotificationViaGmailApi,
  verifyGmailBearerToken,
} from './notifications';

test('resolveNotificationRecipient defaults to thecontinental.dhpc@gmail.com', () => {
  assert.equal(resolveNotificationRecipient(''), 'thecontinental.dhpc@gmail.com');
  assert.equal(resolveNotificationRecipient('thecontinental.dhpc@gmail.com'), 'thecontinental.dhpc@gmail.com');
});

test('verifyGmailBearerToken validates incoming Bearer token against Gmail profile endpoint', async () => {
  const missing = await verifyGmailBearerToken('   ');
  assert.equal(missing.valid, false);

  const valid = await verifyGmailBearerToken('ya29.test-token', (async (url, init) => {
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
    assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer ya29.test-token');
    return new Response(JSON.stringify({ emailAddress: 'thecontinental.dhpc@gmail.com' }), { status: 200 });
  }) as typeof fetch);

  assert.equal(valid.valid, true);
  assert.equal(valid.emailAddress, 'thecontinental.dhpc@gmail.com');
});

test('sendNotificationViaGmailApi posts raw RFC-2822 email to Gmail API for thecontinental.dhpc@gmail.com', async () => {
  let capturedBody = '';
  let capturedAuth = '';

  const res = await sendNotificationViaGmailApi({
    accessToken: 'ya29.gmail-send',
    senderEmail: 'thecontinental.dhpc@gmail.com',
    to: 'thecontinental.dhpc@gmail.com',
    subject: 'New Newsletter Subscriber',
    text: 'reader@example.com subscribed',
    html: '<p>reader@example.com subscribed</p>',
    fetchImpl: (async (url, init) => {
      assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization || '';
      capturedBody = String(init?.body || '');
      return new Response(JSON.stringify({ id: 'msg-12345' }), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(res.ok, true);
  assert.equal(res.messageId, 'msg-12345');
  assert.equal(capturedAuth, 'Bearer ya29.gmail-send');
  const parsed = JSON.parse(capturedBody) as { raw: string };
  const decoded = Buffer.from(parsed.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert.match(decoded, /^To: thecontinental\.dhpc@gmail\.com/m);
  assert.match(decoded, /reader@example\.com subscribed/);
});
