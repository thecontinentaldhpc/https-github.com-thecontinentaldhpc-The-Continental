import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NOV16_NEWS_ARTICLES } from './nov16Edition';

const REQUIRED_CATEGORIES = [
  'world',
  'india',
  'regional',
  'politics',
  'business',
  'economy',
  'education',
  'science-technology',
  'environment',
  'sports',
  'opinion',
  'editorial',
];

const VALID_AUTHOR_SLUGS = new Set([
  'meera-raghavan',
  'arjun-deshmukh',
  'kavita-subramanian',
  'vikramaditya-sen',
  'editorial-board',
]);

test('Nov 16 edition covers all 12 newspaper categories with unique slugs and verified real images', () => {
  const seenSlugs = new Set<string>();
  const seenImages = new Set<string>();
  const coveredCats = new Set<string>();

  for (const art of NOV16_NEWS_ARTICLES) {
    assert.ok(art.title.length >= 12, `Title too short: ${art.title}`);
    assert.ok(art.summary.length >= 40, `Summary too short: ${art.slug}`);
    assert.ok(art.content_html.length >= 180, `Body too short: ${art.slug}`);
    assert.ok(!art.content_html.includes('<script'), `Unsafe script tag in ${art.slug}`);
    assert.ok(art.published_at.startsWith('2026-11-16T'), `Expected today timestamp on ${art.slug}`);
    assert.ok(VALID_AUTHOR_SLUGS.has(art.author_slug), `Unknown author slug: ${art.author_slug}`);
    assert.ok(!seenSlugs.has(art.slug), `Duplicate slug: ${art.slug}`);
    seenSlugs.add(art.slug);
    coveredCats.add(art.category_slug);

    assert.ok(art.featured_image_url, `Missing image on ${art.slug}`);
    assert.ok(art.featured_image_url.startsWith('/assets/news/'), `Unexpected image path: ${art.featured_image_url}`);
    assert.ok(!seenImages.has(art.featured_image_url), `Duplicate image used on ${art.slug}: ${art.featured_image_url}`);
    seenImages.add(art.featured_image_url);
    assert.ok(art.image_caption.length >= 15, `Missing image caption on ${art.slug}`);
    assert.ok(art.image_credit.length >= 4, `Missing image credit on ${art.slug}`);

    const diskPath = path.join(process.cwd(), 'public', art.featured_image_url.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Missing image file on disk: ${diskPath}`);
    const stats = fs.statSync(diskPath);
    assert.ok(stats.size > 20_000, `Suspiciously small image file (${stats.size} bytes): ${diskPath}`);
  }

  for (const cat of REQUIRED_CATEGORIES) {
    assert.ok(coveredCats.has(cat), `Missing coverage for category: ${cat}`);
  }
});

test('Nov 16 edition designates exactly one lead story and three top stories', () => {
  const leads = NOV16_NEWS_ARTICLES.filter((a) => a.featured_slot === 'lead');
  const topStories = NOV16_NEWS_ARTICLES.filter((a) => a.featured_slot === 'top_story');
  assert.equal(leads.length, 1);
  assert.equal(topStories.length, 3);
});
