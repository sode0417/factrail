/**
 * 保存済みのブラウザの Fact（browser.research）を、#178 の基準で洗う（#262 より前に保存した分）。
 *
 * ⭐ 判定は取り込みのときと同じ sanitizeVisitUrl / isSafeSearchQuery を使う。基準を二重に持たない。
 * ⭐ 訪問の数（visit_count）・ドメイン・時刻・要約は変えない。変えるのは URL と検索語だけ。
 *    使うのは scripts/scrub-browser-history-urls.ts。
 */
import { isSafeSearchQuery, sanitizeVisitUrl } from './url-sanitizer';

export interface ScrubStats {
  urls: number;
  urlsRemoved: number;
  urlsRewritten: number;
  searchQueriesRemoved: number;
  sourceUrlChanged: boolean;
}

export interface ScrubResult {
  changed: boolean;
  sourceUrl: string | null;
  metadata: unknown;
  stats: ScrubStats;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 検索語を数えるときと同じ判定（session-splitter の parseSearchQuery と揃える） */
function isSearchUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname.includes('google.') ||
      hostname.includes('bing.com') ||
      hostname.includes('duckduckgo.com')
    );
  } catch {
    return false;
  }
}

/**
 * sourceUrl（セッションの主要 URL）が取り込まない URL だったときの代わり。
 * 取り込みの findPrimaryUrl と同じく「検索以外でタイトルが最も長いもの」を選ぶ。
 */
function pickPrimaryUrl(entries: Array<{ url: string; title: string }>): string | null {
  if (entries.length === 0) return null;
  const nonSearch = entries.filter((e) => !isSearchUrl(e.url));
  if (nonSearch.length > 0) {
    return nonSearch.reduce((best, e) => (e.title.length > best.title.length ? e : best)).url;
  }
  return entries[0].url;
}

export function scrubBrowserFact(sourceUrl: string | null, metadata: unknown): ScrubResult {
  const stats: ScrubStats = {
    urls: 0,
    urlsRemoved: 0,
    urlsRewritten: 0,
    searchQueriesRemoved: 0,
    sourceUrlChanged: false,
  };

  let newMetadata: unknown = metadata;
  const keptEntries: Array<{ url: string; title: string }> = [];

  if (isObject(metadata)) {
    const next: JsonObject = { ...metadata };

    if (Array.isArray(metadata.urls)) {
      const kept: unknown[] = [];
      for (const entry of metadata.urls) {
        if (!isObject(entry) || typeof entry.url !== 'string') {
          // 形の分からないものは中身を確かめられないので残さない
          stats.urls++;
          stats.urlsRemoved++;
          continue;
        }
        stats.urls++;
        const cleaned = sanitizeVisitUrl(entry.url);
        if (cleaned === null) {
          stats.urlsRemoved++;
          continue;
        }
        if (cleaned !== entry.url) stats.urlsRewritten++;
        kept.push({ ...entry, url: cleaned });
        keptEntries.push({
          url: cleaned,
          title: typeof entry.title === 'string' ? entry.title : '',
        });
      }
      next.urls = kept;
    }

    if (Array.isArray(metadata.search_queries)) {
      const queries = metadata.search_queries.filter(
        (q): q is string => typeof q === 'string' && isSafeSearchQuery(q.trim()),
      );
      stats.searchQueriesRemoved = metadata.search_queries.length - queries.length;
      next.search_queries = queries;
    }

    newMetadata = next;
  }

  let newSourceUrl = sourceUrl;
  if (sourceUrl !== null) {
    newSourceUrl = sanitizeVisitUrl(sourceUrl) ?? pickPrimaryUrl(keptEntries);
    stats.sourceUrlChanged = newSourceUrl !== sourceUrl;
  }

  const changed =
    stats.urlsRemoved > 0 ||
    stats.urlsRewritten > 0 ||
    stats.searchQueriesRemoved > 0 ||
    stats.sourceUrlChanged;

  return {
    changed,
    sourceUrl: changed ? newSourceUrl : sourceUrl,
    metadata: changed ? newMetadata : metadata,
    stats,
  };
}
