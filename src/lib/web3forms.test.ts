import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeb3FormsPayload,
  notifyViaWeb3FormsInBackground,
  sendWeb3FormsNotification,
  WEB3FORMS_ENDPOINT,
  WEB3FORMS_RECIPIENT_EMAIL,
} from './web3forms';

test('buildWeb3FormsPayload constructs complete payload with event type, user details, message, and timestamp', () => {
  const payload = buildWeb3FormsPayload(
    {
      eventType: 'New Message',
      userName: 'Ananya Sharma',
      userEmail: 'Ananya@Example.com',
      message: 'Please review our press inquiry.',
      metadata: { Subject: 'Press Inquiry' },
      timestamp: '2026-11-16T10:30:00.000Z',
    },
    'test-web3forms-key'
  );

  assert.equal(payload.access_key, 'test-web3forms-key');
  assert.equal(payload.to, 'thecontinental.dhpc@gmail.com');
  assert.equal(WEB3FORMS_RECIPIENT_EMAIL, 'thecontinental.dhpc@gmail.com');
  assert.equal(payload.name, 'Ananya Sharma');
  assert.equal(payload.email, 'ananya@example.com');
  assert.equal(payload.replyto, 'ananya@example.com');
  assert.equal(payload.event_type, 'New Message');
  assert.equal(payload.timestamp, '2026-11-16T10:30:00.000Z');
  assert.match(payload.subject, /New Message/);
  assert.match(payload.message, /Event Type: New Message/);
  assert.match(payload.message, /User Name: Ananya Sharma/);
  assert.match(payload.message, /User Email: ananya@example\.com/);
  assert.match(payload.message, /Subject: Press Inquiry/);
  assert.match(payload.message, /Please review our press inquiry\./);
  assert.match(payload.message, /Timestamp \(UTC\): 2026-11-16T10:30:00\.000Z/);
  assert.match(payload.message, /Timestamp \(IST\):/);
});

test('buildWeb3FormsPayload provides safe fallback email when user signs in via phone only', () => {
  const payload = buildWeb3FormsPayload(
    {
      eventType: 'New Login',
      userName: 'Reader Mobile',
      userPhone: '+919876543210',
      message: 'Signed in via Phone OTP.',
    },
    'key-123'
  );

  assert.equal(payload.email, 'noreply@thecontinental.dhpc.in');
  assert.equal(payload.replyto, undefined);
  assert.match(payload.message, /User Phone: \+919876543210/);
  assert.match(payload.message, /Event Type: New Login/);
});

test('sendWeb3FormsNotification skips gracefully without throwing when NEXT_PUBLIC_WEB3FORMS_KEY is empty', async () => {
  let called = false;
  const result = await sendWeb3FormsNotification(
    {
      eventType: 'New Subscription',
      userEmail: 'reader@example.com',
    },
    {
      accessKey: '',
      fetchImpl: (async () => {
        called = true;
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
    }
  );

  assert.equal(called, false);
  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
});

test('sendWeb3FormsNotification sends POST request to Web3Forms API with JSON payload', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody = '';

  const result = await sendWeb3FormsNotification(
    {
      eventType: 'New Subscription',
      userEmail: 'subscriber@example.com',
      message: 'Subscribed to morning dispatch.',
    },
    {
      accessKey: 'wf-key-999',
      fetchImpl: (async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = String(init?.method || '');
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        capturedBody = String(init?.body || '');
        return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), { status: 200 });
      }) as typeof fetch,
    }
  );

  assert.equal(result.ok, true);
  assert.equal(capturedUrl, WEB3FORMS_ENDPOINT);
  assert.equal(capturedMethod, 'POST');
  assert.equal(capturedHeaders['Content-Type'], 'application/json');
  const parsed = JSON.parse(capturedBody) as Record<string, unknown>;
  assert.equal(parsed.access_key, 'wf-key-999');
  assert.equal(parsed.to, 'thecontinental.dhpc@gmail.com');
  assert.equal(parsed.event_type, 'New Subscription');
});

test('sendWeb3FormsNotification handles HTTP errors and network rejections without throwing', async () => {
  const httpFail = await sendWeb3FormsNotification(
    { eventType: 'New Login', userEmail: 'user@example.com' },
    {
      accessKey: 'wf-key-999',
      fetchImpl: (async () => new Response(JSON.stringify({ success: false, message: 'Rate limited' }), { status: 429 })) as typeof fetch,
    }
  );
  assert.equal(httpFail.ok, false);
  assert.equal(httpFail.status, 429);
  assert.match(httpFail.error || '', /Rate limited/);

  const netFail = await sendWeb3FormsNotification(
    { eventType: 'New Login', userEmail: 'user@example.com' },
    {
      accessKey: 'wf-key-999',
      fetchImpl: (async () => {
        throw new Error('Network unreachable');
      }) as typeof fetch,
    }
  );
  assert.equal(netFail.ok, false);
  assert.match(netFail.error || '', /Network unreachable/);
});

test('notifyViaWeb3FormsInBackground returns synchronously without blocking even when fetch is slow or rejects', async () => {
  const start = Date.now();
  let fetchResolved = false;

  notifyViaWeb3FormsInBackground(
    { eventType: 'New Submission', userName: 'Author', userEmail: 'author@example.com', message: 'Draft title' },
    {
      accessKey: 'wf-key-999',
      fetchImpl: (async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        fetchResolved = true;
        throw new Error('Simulated background failure');
      }) as typeof fetch,
    }
  );

  const elapsed = Date.now() - start;
  assert.ok(elapsed < 30, `Expected non-blocking return, took ${elapsed}ms`);
  assert.equal(fetchResolved, false);

  // Wait for background promise to settle cleanly without unhandled rejection
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(fetchResolved, true);
});
