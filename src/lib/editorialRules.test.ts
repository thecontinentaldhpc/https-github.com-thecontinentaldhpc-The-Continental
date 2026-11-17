import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReadingTimeMinutes,
  canPublishEdition,
  canPublishSubmission,
  convertPlainTextToParagraphHtml,
  generateSlug,
  generateSubmissionCode,
  getNotificationRecipientEmail,
  isAdminEmail,
  isNotificationRecipientEmail,
  NOTIFICATION_EMAIL,
  resolveRoleForEmail,
  sanitizeEditorialHtml,
} from './editorialRules';

test('generateSlug produces clean SEO-friendly slugs', () => {
  assert.equal(
    generateSlug('Global Climate Pact: 2027 Targets & Maritime Trade!'),
    'global-climate-pact-2027-targets-maritime-trade'
  );
});

test('sanitizeEditorialHtml removes scripts, iframes, event handlers, and javascript URLs', () => {
  const dirty =
    '<h2>Headline</h2><p onclick="alert(1)">Text</p><script>evil()</script><a href="javascript:steal()">Link</a><iframe src="https://x.com"></iframe>';
  const clean = sanitizeEditorialHtml(dirty);
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('<iframe'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(clean.includes('<h2>Headline</h2>'));
  assert.ok(clean.includes('<p>Text</p>'));
});

test('calculateReadingTimeMinutes computes reading duration accurately', () => {
  const words = new Array(450).fill('journalism').join(' ');
  assert.equal(calculateReadingTimeMinutes(`<p>${words}</p>`), 3);
  assert.equal(calculateReadingTimeMinutes('<p>Short note.</p>'), 1);
});

test('submission and edition publishing gates enforce editorial workflow', () => {
  assert.equal(canPublishSubmission('Submitted'), false);
  assert.equal(canPublishSubmission('Under Review'), false);
  assert.equal(canPublishSubmission('Revision Requested'), false);
  assert.equal(canPublishSubmission('Rejected'), false);
  assert.equal(canPublishSubmission('Approved'), true);

  assert.equal(canPublishEdition(null, true), false);
  assert.equal(canPublishEdition('/uploads/epaper.pdf', false), false);
  assert.equal(canPublishEdition('/uploads/epaper.pdf', true), true);
});

test('generateSubmissionCode and plain-text conversion format cleanly', () => {
  const code = generateSubmissionCode(new Date('2027-01-04T10:00:00Z'), 'AB12');
  assert.equal(code, 'TC-SUB-20270104-AB12');

  const html = convertPlainTextToParagraphHtml('First paragraph.\n\nSecond <script>bad</script> paragraph.');
  assert.ok(html.includes('<p>First paragraph.</p>'));
  assert.ok(!html.includes('<script>'));
});

test('resolveRoleForEmail grants super_admin exclusively to verified thecontinental.dhpc@gmail.com', () => {
  assert.equal(isAdminEmail('thecontinental.dhpc@gmail.com'), true);
  assert.equal(isAdminEmail('THECONTINENTAL.DHPC@GMAIL.COM'), true);
  assert.equal(isAdminEmail('other@example.com'), false);
  assert.equal(isAdminEmail('reader@example.com'), false);

  assert.equal(resolveRoleForEmail('thecontinental.dhpc@gmail.com', true), 'super_admin');
  assert.equal(resolveRoleForEmail('TheContinental.DHPC@gmail.com', true), 'super_admin');
  assert.equal(resolveRoleForEmail('thecontinental.dhpc@gmail.com', false), 'reader');
  assert.equal(resolveRoleForEmail('writer@example.com', true), 'reader');
  assert.equal(resolveRoleForEmail(null, true), 'reader');
});

test('notification recipient and Gmail connect target thecontinental.dhpc@gmail.com', () => {
  assert.equal(NOTIFICATION_EMAIL, 'thecontinental.dhpc@gmail.com');
  assert.equal(isNotificationRecipientEmail('thecontinental.dhpc@gmail.com'), true);
  assert.equal(isNotificationRecipientEmail('THECONTINENTAL.DHPC@GMAIL.COM'), true);
  assert.equal(isNotificationRecipientEmail('other@example.com'), false);

  assert.equal(getNotificationRecipientEmail(), 'thecontinental.dhpc@gmail.com');
  assert.equal(getNotificationRecipientEmail('thecontinental.dhpc@gmail.com'), 'thecontinental.dhpc@gmail.com');
  assert.equal(getNotificationRecipientEmail(''), 'thecontinental.dhpc@gmail.com');
  assert.equal(getNotificationRecipientEmail('custom.inbox@example.com'), 'custom.inbox@example.com');
});

