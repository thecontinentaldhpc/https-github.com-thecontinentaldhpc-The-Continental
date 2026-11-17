import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasSavedArticle,
  isValidFirestoreId,
  normalizeSavedArticleDoc,
  normalizeTimestampValue,
  removeSavedArticleFromList,
  sortReadingListNewestFirst,
  toSavedArticlePayload,
  upsertSavedArticleInList,
  type SavedArticleInput,
} from './readingList';

const sampleArticle: SavedArticleInput = {
  id: '03288c76-60a3-443a-a30b-b1a822159fc8',
  slug: 'maritime-trade-corridor-report',
  title: '  Maritime Trade Corridors Expand Across South Asia  ',
  summary: 'Ports announce modernized customs clearance and rail-freight integration.',
  subheadline: 'Fallback subheadline',
  category_name: 'Economy',
  category_slug: 'economy',
  author_name: 'Ananya Sharma',
  featured_image_url: '/assets/news/cochin-shipyard.jpg',
  published_at: '2026-11-16T08:30:00.000Z',
  created_at: '2026-11-16T08:00:00.000Z',
};

test('isValidFirestoreId enforces strict alphanumeric, hyphen, underscore bounds', () => {
  assert.equal(isValidFirestoreId('03288c76-60a3-443a-a30b-b1a822159fc8'), true);
  assert.equal(isValidFirestoreId('user_123-abc'), true);
  assert.equal(isValidFirestoreId(''), false);
  assert.equal(isValidFirestoreId('bad/id'), false);
  assert.equal(isValidFirestoreId('bad id'), false);
});

test('toSavedArticlePayload clamps strings to blueprint bounds and omits empty image URL', () => {
  const longTitle = 'A'.repeat(400);
  const longSummary = 'B'.repeat(1500);
  const payload = toSavedArticlePayload(
    {
      ...sampleArticle,
      title: longTitle,
      summary: longSummary,
      featured_image_url: '   ',
    },
    'uid_reader_01'
  );

  assert.equal(payload.id, sampleArticle.id);
  assert.equal(payload.articleId, sampleArticle.id);
  assert.equal(payload.userId, 'uid_reader_01');
  assert.equal(payload.title.length, 300);
  assert.equal(payload.summary.length, 1000);
  assert.equal('featuredImageUrl' in payload, false);
});

test('toSavedArticlePayload preserves valid featuredImageUrl under 500 chars', () => {
  const payload = toSavedArticlePayload(sampleArticle, 'uid_reader_01');
  assert.equal(payload.featuredImageUrl, '/assets/news/cochin-shipyard.jpg');
});

test('normalizeTimestampValue handles Firestore Timestamp objects and ISO strings', () => {
  assert.equal(
    normalizeTimestampValue({ toDate: () => new Date('2026-11-16T10:00:00.000Z') }),
    '2026-11-16T10:00:00.000Z'
  );
  assert.equal(normalizeTimestampValue({ _seconds: 1700000000 }), new Date(1700000000 * 1000).toISOString());
  assert.equal(normalizeTimestampValue('2026-11-15T06:30:00.000Z'), '2026-11-15T06:30:00.000Z');
});

test('normalizeSavedArticleDoc validates required fields and normalizes savedAt', () => {
  const item = normalizeSavedArticleDoc(
    {
      userId: 'u1',
      articleId: 'art-1',
      slug: 'headline-slug',
      title: 'Headline',
      summary: 'Brief',
      categoryName: 'World',
      categorySlug: 'world',
      authorName: 'Bureau',
      publishedAt: '2026-11-16T08:30:00.000Z',
      savedAt: { seconds: 1700000000 },
    },
    'art-1'
  );
  assert.ok(item);
  assert.equal(item.id, 'art-1');
  assert.equal(item.savedAt, new Date(1700000000 * 1000).toISOString());

  assert.equal(normalizeSavedArticleDoc({ title: 'Missing slug' }, 'art-2'), null);
});

test('sortReadingListNewestFirst, upsert, remove, and hasSavedArticle maintain consistent reading list state', () => {
  const older = {
    id: 'art-1',
    userId: 'u1',
    articleId: 'art-1',
    slug: 'older',
    title: 'Older Dispatch',
    summary: '',
    categoryName: 'World',
    categorySlug: 'world',
    authorName: 'Staff',
    featuredImageUrl: null,
    publishedAt: '2026-11-14T10:00:00.000Z',
    savedAt: '2026-11-15T09:00:00.000Z',
  };
  const newer = {
    ...older,
    id: 'art-2',
    articleId: 'art-2',
    slug: 'newer',
    title: 'Newer Dispatch',
    savedAt: '2026-11-16T11:00:00.000Z',
  };

  const sorted = sortReadingListNewestFirst([older, newer]);
  assert.deepEqual(
    sorted.map((x) => x.articleId),
    ['art-2', 'art-1']
  );
  assert.equal(hasSavedArticle(sorted, 'art-1'), true);
  assert.equal(hasSavedArticle(sorted, 'art-3'), false);

  const updatedOlder = { ...older, savedAt: '2026-11-17T12:00:00.000Z' };
  const upserted = upsertSavedArticleInList(sorted, updatedOlder);
  assert.deepEqual(
    upserted.map((x) => x.articleId),
    ['art-1', 'art-2']
  );

  const removed = removeSavedArticleFromList(upserted, 'art-1');
  assert.deepEqual(
    removed.map((x) => x.articleId),
    ['art-2']
  );
});
