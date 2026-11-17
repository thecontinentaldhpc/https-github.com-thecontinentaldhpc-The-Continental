import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyArticleCategory,
  computeTitleSimilarity,
  decodeXmlEntities,
  mergeDevelopingStoryUpdate,
  parseRssFeedXml,
  synthesizeEditorialDispatch,
} from './liveNewsParser';

test('decodeXmlEntities decodes CDATA and XML/HTML entities accurately', () => {
  const decoded = decodeXmlEntities('<![CDATA[India &amp; ASEAN&#39;s &#x201C;Act East&#x201D; summit]]>');
  assert.equal(decoded, 'India & ASEAN\'s “Act East” summit');
});

test('parseRssFeedXml parses Google News clusters and strips source suffix cleanly', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <item>
      <title>Chip tensions loom over summit, as nations push AI safety steps - Reuters</title>
      <link>https://news.google.com/rss/articles/sample123</link>
      <guid isPermaLink="false">gnews-123</guid>
      <pubDate>Mon, 16 Nov 2026 12:15:34 GMT</pubDate>
      <description>&lt;ol&gt;&lt;li&gt;&lt;a href="#"&gt;Chip tensions loom over summit, as nations push AI safety steps&lt;/a&gt;&lt;font&gt;Reuters&lt;/font&gt;&lt;/li&gt;&lt;li&gt;&lt;a href="#"&gt;Semiconductor export rules reviewed ahead of ministerial talks&lt;/a&gt;&lt;font&gt;The Hindu&lt;/font&gt;&lt;/li&gt;&lt;/ol&gt;</description>
      <source url="https://www.reuters.com">Reuters</source>
    </item>
  </channel></rss>`;

  const items = parseRssFeedXml(sampleXml, 'google-news', 'world');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Chip tensions loom over summit, as nations push AI safety steps');
  assert.equal(items[0].sourceName, 'Reuters');
  assert.equal(items[0].clusterHeadlines.length, 2);
  assert.equal(items[0].clusterHeadlines[1].source, 'The Hindu');
});

test('parseRssFeedXml parses The Hindu media:content image and category', () => {
  const hinduXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
    <item>
      <title><![CDATA[Cyclone Akvan to make landfall along Andhra coast]]></title>
      <description><![CDATA[Fishermen advised to remain ashore as IMD issues storm warning.]]></description>
      <link><![CDATA[https://www.thehindu.com/news/national/cyclone-akvan/article71706785.ece]]></link>
      <guid isPermaLink="false">article-71706785</guid>
      <category><![CDATA[Andhra Pradesh]]></category>
      <pubDate><![CDATA[Mon, 16 Nov 2026 22:34:51 +0530]]></pubDate>
      <media:content height="675" medium="image" url="https://th-i.thgim.com/public/news/sample.jpg" width="1200"/>
    </item>
  </channel></rss>`;

  const items = parseRssFeedXml(hinduXml, 'the-hindu', 'india');
  assert.equal(items.length, 1);
  assert.equal(items[0].imageUrl, 'https://th-i.thgim.com/public/news/sample.jpg');
  assert.equal(items[0].sourceName, 'The Hindu');
  assert.equal(items[0].feedCategory, 'Andhra Pradesh');

  const dispatch = synthesizeEditorialDispatch(items[0]);
  assert.equal(dispatch.categorySlug, 'environment');
  assert.equal(dispatch.isBreaking, true);
  assert.equal(dispatch.featuredImageUrl, 'https://th-i.thgim.com/public/news/sample.jpg');
  assert.ok(dispatch.contentHtml.includes('Editorial Verification'));
});

test('classifyArticleCategory routes sports, economy, and science stories accurately', () => {
  assert.equal(classifyArticleCategory('India wins Test match with five-wicket haul', '', '', 'india'), 'sports');
  assert.equal(classifyArticleCategory('RBI holds repo rate steady amid core inflation watch', '', '', 'india'), 'economy');
  assert.equal(classifyArticleCategory('ISRO schedules polar satellite launch for Earth imaging', '', '', 'india'), 'science-technology');
});

test('computeTitleSimilarity and mergeDevelopingStoryUpdate detect and enrich developing issues without duplication', () => {
  const sim = computeTitleSimilarity(
    'Cyclone Akvan to make landfall along Andhra coast',
    'Cyclone Akvan: Odisha deploys 74 rescue teams ahead of Andhra landfall'
  );
  assert.ok(sim >= 0.35);

  const parsed = parseRssFeedXml(
    `<rss version="2.0"><channel><item>
      <title>Cyclone Akvan intensifies as Odisha deploys 74 disaster rescue teams</title>
      <description>Coastal districts evacuate vulnerable residents ahead of storm surge.</description>
      <link>https://www.thehindu.com/news/cyclone-update</link>
      <guid>article-cyclone-2</guid>
      <pubDate>Tue, 17 Nov 2026 07:00:00 +0530</pubDate>
    </item></channel></rss>`,
    'the-hindu',
    'india'
  )[0];

  const synthesized = synthesizeEditorialDispatch(parsed);
  const merged = mergeDevelopingStoryUpdate(
    '<p>IMD issued initial storm warning for Nellore.</p>',
    'Initial storm warning issued.',
    synthesized,
    '2026-11-17T01:45:00.000Z'
  );
  assert.equal(merged.changed, true);
  assert.match(merged.nextContentHtml, /Developing Update/);

  // Re-applying identical info does not duplicate
  const repeat = mergeDevelopingStoryUpdate(
    merged.nextContentHtml,
    merged.nextSummary,
    synthesized,
    '2026-11-17T01:50:00.000Z'
  );
  assert.equal(repeat.changed, false);
});
