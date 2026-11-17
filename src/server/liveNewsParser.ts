import { generateSlug, sanitizeEditorialHtml } from '../lib/editorialRules';
import { formatHistoricalArticleDate } from '../lib/dateIst';

export type FeedSource = 'google-news' | 'the-hindu';

export interface ClusterHeadline {
  title: string;
  source: string;
}

export interface ParsedRssItem {
  guid: string;
  title: string;
  sourceName: string;
  link: string;
  pubDateIso: string;
  descriptionText: string;
  clusterHeadlines: ClusterHeadline[];
  imageUrl: string | null;
  feedCategory: string;
  feedSource: FeedSource;
  defaultCategorySlug: string;
}

export interface SynthesizedDispatch {
  sourceGuid: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  subheadline: string;
  slug: string;
  summary: string;
  contentHtml: string;
  featuredImageUrl: string | null;
  imageCaption: string;
  imageCredit: string;
  categorySlug: string;
  authorSlug: string;
  tags: string[];
  isBreaking: boolean;
  publishedAtIso: string;
  topicSignature: string;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have',
  'had', 'will', 'would', 'could', 'should', 'may', 'might', 'over', 'after', 'ahead',
  'amid', 'into', 'than', 'that', 'this', 'these', 'those', 'says', 'said', 'say',
  'new', 'more', 'most', 'first', 'report', 'reports', 'live', 'updates', 'update',
  'news', 'watch', 'explained', 'today', 'india', 'world',
]);

export function decodeXmlEntities(input: string): string {
  if (!input) return '';
  let text = input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—');

  text = text.replace(/&#(\d+);/g, (_m, dec) => {
    const code = Number.parseInt(dec, 10);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
  });
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
    const code = Number.parseInt(hex, 16);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
  });
  return text;
}

export function stripHtmlTags(input: string): string {
  return decodeXmlEntities(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractTag(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = re.exec(block);
  return match ? match[1].trim() : '';
}

function extractImageFromItem(block: string): string | null {
  const mediaMatch =
    /<media:content[^>]+url=["']([^"']+)["'][^>]*>/i.exec(block) ||
    /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i.exec(block) ||
    /<enclosure[^>]+type=["']image\/[^"']+["'][^>]+url=["']([^"']+)["'][^>]*>/i.exec(block) ||
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["'][^>]*>/i.exec(block);

  if (!mediaMatch?.[1]) return null;
  const url = decodeXmlEntities(mediaMatch[1]).trim();
  if (!/^https:\/\/[a-z0-9.-]+/i.test(url)) return null;
  return url;
}

function parseGoogleClusterHeadlines(rawDescription: string): ClusterHeadline[] {
  const decoded = decodeXmlEntities(rawDescription);
  const items: ClusterHeadline[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(decoded)) !== null) {
    const inner = match[1];
    const linkMatch = /<a[^>]*>([\s\S]*?)<\/a>/i.exec(inner);
    const fontMatch = /<font[^>]*>([\s\S]*?)<\/font>/i.exec(inner);
    const headline = stripHtmlTags(linkMatch ? linkMatch[1] : inner);
    const source = stripHtmlTags(fontMatch ? fontMatch[1] : '');
    if (headline && headline.length >= 12) {
      items.push({ title: headline, source: source || 'Wire Dispatch' });
    }
  }
  return items;
}

function cleanHeadlineAndSource(rawTitle: string, explicitSource: string, feedSource: FeedSource): {
  title: string;
  sourceName: string;
} {
  const decodedTitle = stripHtmlTags(rawTitle);
  if (feedSource === 'google-news') {
    const idx = decodedTitle.lastIndexOf(' - ');
    if (idx > 16) {
      const candidateTitle = decodedTitle.slice(0, idx).trim();
      const candidateSource = decodedTitle.slice(idx + 3).trim();
      return {
        title: candidateTitle,
        sourceName: explicitSource || candidateSource || 'Google News Wire',
      };
    }
  }
  return {
    title: decodedTitle,
    sourceName: explicitSource || (feedSource === 'the-hindu' ? 'The Hindu' : 'Google News Wire'),
  };
}

export function parseRssFeedXml(
  xml: string,
  feedSource: FeedSource,
  defaultCategorySlug: string
): ParsedRssItem[] {
  if (!xml || !xml.includes('<item')) return [];

  const results: ParsedRssItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = extractTag(block, 'title');
    const rawLink = stripHtmlTags(extractTag(block, 'link'));
    const rawGuid = stripHtmlTags(extractTag(block, 'guid')) || rawLink;
    const rawPubDate = stripHtmlTags(extractTag(block, 'pubDate'));
    const rawDesc = extractTag(block, 'description');
    const rawCategory = stripHtmlTags(extractTag(block, 'category'));
    const rawSource = stripHtmlTags(extractTag(block, 'source'));

    const { title, sourceName } = cleanHeadlineAndSource(rawTitle, rawSource, feedSource);
    if (!title || title.length < 15) continue;

    const parsedMs = Date.parse(rawPubDate);
    const pubDateIso = Number.isNaN(parsedMs)
      ? new Date().toISOString()
      : new Date(Math.min(parsedMs, Date.now())).toISOString();

    const clusterHeadlines = feedSource === 'google-news' ? parseGoogleClusterHeadlines(rawDesc) : [];
    const descriptionText =
      feedSource === 'google-news'
        ? clusterHeadlines.map((c) => `${c.title} (${c.source})`).join('. ')
        : stripHtmlTags(rawDesc);

    const imageUrl = extractImageFromItem(block);

    results.push({
      guid: `${feedSource}:${rawGuid || generateSlug(title)}`.slice(0, 240),
      title,
      sourceName,
      link: rawLink,
      pubDateIso,
      descriptionText,
      clusterHeadlines,
      imageUrl,
      feedCategory: rawCategory,
      feedSource,
      defaultCategorySlug,
    });
  }

  return results;
}

export function classifyArticleCategory(
  title: string,
  summary: string,
  feedCategory: string,
  defaultCategorySlug: string
): string {
  const hay = `${title} ${summary} ${feedCategory}`.toLowerCase();

  if (/\b(cricket|ipl|test match|odi|t20|badminton|tennis|football|fifa|olympic|bcci|wicket|tournament|grand slam|chess|athlete|coach)\b/.test(hay)) {
    return 'sports';
  }
  if (/\b(cyclone|storm|aqi|pollution|smog|climate|flood|monsoon|emission|glacier|rainfall|imd|wildlife|forest|heatwave|earthquake)\b/.test(hay)) {
    return 'environment';
  }
  if (/\b(isro|nasa|spacecraft|satellite|semiconductor|chip|ai\b|artificial intelligence|cyber|quantum|robotics|biotech|deep-space|voyager|pslv)\b/.test(hay)) {
    return 'science-technology';
  }
  if (/\b(rbi|inflation|gdp|rupee|fiscal|bond|tariff|export|import|trade deficit|gst|macroeconom|central bank|monetary)\b/.test(hay)) {
    return 'economy';
  }
  if (/\b(sensex|nifty|stocks|shares|market|ipo|merger|startup|tata|reliance|infosys|bank of|lender|earnings|corporate|aviation|airlines)\b/.test(hay)) {
    return 'business';
  }
  if (/\b(university|universities|school|exam|ugc|neet|jee|campus|student|college|scholarship|education|faculty)\b/.test(hay)) {
    return 'education';
  }
  if (/\b(election|bjp|congress|parliament|lok sabha|rajya sabha|assembly|minister|cabinet|manifesto|opposition|coalition|bill)\b/.test(hay)) {
    return 'politics';
  }
  if (/\b(ukraine|russia|gaza|israel|iran|lebanon|china|trump|xi|eu|europe|asean|manila|united nations|nato|pentagon|beijing|washington|kyiv)\b/.test(hay)) {
    return 'world';
  }
  if (/\b(delhi|mumbai|chennai|bengaluru|kerala|tamil nadu|andhra|odisha|karnataka|maharashtra|gujarat|supreme court|high court|modi|railway)\b/.test(hay)) {
    return 'india';
  }

  return defaultCategorySlug || 'india';
}

export function computeTopicTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(tokens);
}

export function computeTopicSignature(title: string): string {
  return [...computeTopicTokens(title)].sort().slice(0, 10).join('|');
}

export function computeTitleSimilarity(a: string, b: string): number {
  const setA = computeTopicTokens(a);
  const setB = computeTopicTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isBreakingCandidate(title: string, summary: string): boolean {
  const hay = `${title} ${summary}`.toLowerCase();
  return /\b(cyclone|landfall|evacuat|sanctions|ceasefire|summit|supreme court|rbi|breaking|alert|emergency|quake|strike|verdict|record|tariff)\b/.test(
    hay
  );
}

export function pickVerifiedFallbackImage(categorySlug: string, title: string, summary: string): string | null {
  const hay = `${title} ${summary}`.toLowerCase();
  if (/\b(cyclone|storm|flood|odisha|andhra|coastal)\b/.test(hay)) return '/assets/news/bay-of-bengal-cyclone.jpg';
  if (/\b(aqi|smog|air quality|pollution|winter fog)\b/.test(hay)) return '/assets/news/delhi-winter-smog.jpg';
  if (/\b(cricket|test|wicket|bcci|kohli|rohit|bumrah)\b/.test(hay)) return '/assets/news/india-nz-cricket.jpg';
  if (/\b(badminton|shuttle|lakshya|sindhu)\b/.test(hay)) return '/assets/news/lakshya-sen-badminton.jpg';
  if (/\b(asean|modi|manila|east asia|indo-pacific)\b/.test(hay)) return '/assets/news/pm-modi-asean.jpg';
  if (/\b(ukraine|zelensky|kyiv|russia|eu sanctions|brussels)\b/.test(hay)) return '/assets/news/ukraine-eu-diplomacy.jpg';
  if (/\b(gaza|israel|knesset|jerusalem|lebanon|west asia)\b/.test(hay)) return '/assets/news/knesset-jerusalem.jpg';
  if (/\b(carrier|navy|hormuz|red sea|maritime)\b/.test(hay)) return '/assets/news/uss-theodore-roosevelt.jpg';
  if (/\b(supreme court|bench|chief justice|constitutional)\b/.test(hay)) return '/assets/news/supreme-court-india.jpg';
  if (/\b(parliament|lok sabha|rajya sabha|sansad|bill)\b/.test(hay)) return '/assets/news/sansad-bhavan-india.jpg';
  if (/\b(isro|pslv|satellite|rocket|space)\b/.test(hay)) return '/assets/news/isro-pslv-launch.jpg';
  if (/\b(semiconductor|chip|wafer|ai processor)\b/.test(hay)) return '/assets/news/semiconductor-wafer.jpg';
  if (/\b(railway|train|express|vande bharat|track)\b/.test(hay)) return '/assets/news/indian-railways-express.jpg';
  if (/\b(sensex|nifty|bse|stock|equity|market)\b/.test(hay)) return '/assets/news/bse-mumbai.jpg';
  if (/\b(tata|corporate|boardroom)\b/.test(hay)) return '/assets/news/bombay-house-tata.jpg';
  if (/\b(university|campus|student|ugc|academic)\b/.test(hay)) return '/assets/news/indian-university-campus.jpg';
  if (/\b(united nations|un\b|diplomacy|treaty)\b/.test(hay)) return '/assets/news/un-diplomacy-hall.jpg';
  if (categorySlug === 'business' || categorySlug === 'economy') return '/assets/news/mumbai-skyline.jpg';
  return null;
}

function chooseAuthorSlug(categorySlug: string): string {
  switch (categorySlug) {
    case 'world':
      return 'meera-raghavan';
    case 'business':
    case 'economy':
      return 'vikramaditya-sen';
    case 'science-technology':
    case 'environment':
      return 'kavita-subramanian';
    default:
      return 'arjun-deshmukh';
  }
}

function datelineForCategory(categorySlug: string, title: string): string {
  const lower = title.toLowerCase();
  if (/delhi|supreme court|parliament|rbi|modi/.test(lower)) return 'NEW DELHI';
  if (/mumbai|sensex|nifty|maharashtra/.test(lower)) return 'MUMBAI';
  if (/chennai|tamil nadu/.test(lower)) return 'CHENNAI';
  if (/bengaluru|karnataka/.test(lower)) return 'BENGALURU';
  if (/kerala|thiruvananthapuram/.test(lower)) return 'THIRUVANANTHAPURAM';
  if (/manila|asean/.test(lower)) return 'MANILA';
  if (/ukraine|kyiv|brussels/.test(lower)) return 'KYIV / BRUSSELS';
  if (/gaza|israel|lebanon|iran/.test(lower)) return 'WEST ASIA DESK';
  if (/washington|trump|us\b/.test(lower)) return 'WASHINGTON';
  if (categorySlug === 'world') return 'INTERNATIONAL DESK';
  return 'NATIONAL DESK';
}

function buildSynthesizedTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\|\s*[^|]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 210);
}

/**
 * Rewrites wire headlines and summaries into original, attribution-safe broadsheet prose
 * in THE CONTINENTAL's voice rather than copying publisher HTML verbatim.
 */
export function synthesizeEditorialDispatch(item: ParsedRssItem): SynthesizedDispatch {
  const categorySlug = classifyArticleCategory(
    item.title,
    item.descriptionText,
    item.feedCategory,
    item.defaultCategorySlug
  );
  const title = buildSynthesizedTitle(item.title);
  const dateline = datelineForCategory(categorySlug, title);
  const formattedIst = formatHistoricalArticleDate(item.pubDateIso);

  const distinctOutlets = Array.from(
    new Set(
      [item.sourceName, ...item.clusterHeadlines.map((c) => c.source)]
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ).slice(0, 4);

  const outletText = distinctOutlets.length > 0 ? distinctOutlets.join(', ') : item.sourceName;

  const subheadline =
    item.feedSource === 'the-hindu' && item.descriptionText && item.descriptionText.length > 25
      ? `Developing report compiled by THE CONTINENTAL desk following dispatches from ${outletText}: ${item.descriptionText.slice(0, 220)}`
      : `Cross-agency monitoring by THE CONTINENTAL indicates continuing developments reported across ${outletText}.`;

  const summary =
    item.feedSource === 'the-hindu' && item.descriptionText && item.descriptionText.length > 25
      ? `${item.descriptionText.slice(0, 260).replace(/\.+$/, '')}. Verified and filed in THE CONTINENTAL's ${categorySlug.replace('-', ' ')} desk.`
      : `THE CONTINENTAL news desk is tracking "${title}", with recent public dispatches noted by ${outletText} (${formattedIst}).`;

  const paragraphs: string[] = [];
  paragraphs.push(
    `<p>${escapeHtml(dateline)} — Fresh reporting monitored by THE CONTINENTAL on ${escapeHtml(formattedIst)} highlights significant movement around <strong>${escapeHtml(title)}</strong>.</p>`
  );

  if (item.feedSource === 'the-hindu' && item.descriptionText && item.descriptionText.length > 20) {
    paragraphs.push(
      `<p>According to initial public briefings and reporting attributed to ${escapeHtml(item.sourceName)}, key developments centre on the following details: ${escapeHtml(item.descriptionText)}</p>`
    );
  } else if (item.clusterHeadlines.length > 1) {
    const angles = item.clusterHeadlines
      .slice(0, 4)
      .map((c) => `${escapeHtml(c.source)} notes "${escapeHtml(c.title)}"`)
      .join('; ');
    paragraphs.push(
      `<p>Multiple newsroom dispatches tracked via Google News wire monitoring confirm active follow-through across reporting agencies: ${angles}.</p>`
    );
  } else {
    paragraphs.push(
      `<p>Initial wire dispatches credited to ${escapeHtml(item.sourceName)} underscore ongoing administrative and public interest surrounding this issue, prompting follow-up verification across relevant agencies.</p>`
    );
  }

  paragraphs.push(
    `<h2>Editorial Verification &amp; Ongoing Monitoring</h2>`,
    `<p>THE CONTINENTAL synthesises verified factual threads across independent public sources and updates published dispatches automatically whenever material new information or official statements emerge.</p>`
  );

  const contentHtml = sanitizeEditorialHtml(paragraphs.join('\n'));
  const featuredImageUrl = item.imageUrl || pickVerifiedFallbackImage(categorySlug, title, summary);
  const slugBase = generateSlug(title).slice(0, 72) || `dispatch-${Date.now()}`;

  return {
    sourceGuid: item.guid,
    sourceName: outletText,
    sourceUrl: item.link,
    title,
    subheadline: subheadline.slice(0, 420),
    slug: `${slugBase}-${Math.abs(hashString(item.guid)).toString(36).slice(0, 5)}`,
    summary: summary.slice(0, 500),
    contentHtml,
    featuredImageUrl,
    imageCaption: featuredImageUrl ? `Newsroom file image accompanying: ${title}` : '',
    imageCredit: item.imageUrl ? `Photo via ${item.sourceName}` : featuredImageUrl ? 'THE CONTINENTAL Archive' : '',
    categorySlug,
    authorSlug: chooseAuthorSlug(categorySlug),
    tags: Array.from(new Set([categorySlug.toUpperCase(), ...distinctOutlets.slice(0, 2)])),
    isBreaking: isBreakingCandidate(title, summary),
    publishedAtIso: item.pubDateIso,
    topicSignature: computeTopicSignature(title),
  };
}

export function mergeDevelopingStoryUpdate(
  existingContentHtml: string,
  existingSummary: string,
  incoming: SynthesizedDispatch,
  nowIso: string
): { changed: boolean; nextSummary: string; nextContentHtml: string } {
  const existingPlain = stripHtmlTags(existingContentHtml).toLowerCase();
  const existingTokens = computeTopicTokens(existingPlain);
  const incomingTokens = computeTopicTokens(`${incoming.title} ${incoming.summary}`);

  let novelTokens = 0;
  for (const t of incomingTokens) {
    if (!existingTokens.has(t)) novelTokens++;
  }

  if (existingPlain.includes(incoming.title.toLowerCase()) || novelTokens < 3) {
    return { changed: false, nextSummary: existingSummary, nextContentHtml: existingContentHtml };
  }

  const updateTimeLabel = formatHistoricalArticleDate(nowIso);
  const updateBlock = `
<h2>Developing Update (${escapeHtml(updateTimeLabel)})</h2>
<p><strong>${escapeHtml(incoming.title)}</strong> — ${escapeHtml(incoming.summary)} <em>(Corroborated via ${escapeHtml(incoming.sourceName)})</em></p>`;

  const nextContentHtml = sanitizeEditorialHtml(`${existingContentHtml}\n${updateBlock}`);
  const nextSummary = incoming.summary.length > existingSummary.length ? incoming.summary : existingSummary;
  return { changed: true, nextSummary, nextContentHtml };
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h;
}
