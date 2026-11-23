/**
 * 保存済みのブラウザの Fact（browser.research）を、#178 の基準で洗う（#262 より前に保存した分）。
 *
 * ⭐ URL の判定は取り込みのときと同じ sanitizeVisitUrl を使う。検索語・ドメイン・主要 URL は、
 *    洗った URL から取り込みと同じ手順（session-splitter）で作り直し、前からあったものとの共通部分だけを残す。
 *    基準を二重に持たないため。
 * ⭐ 取り除いた検索語と鍵の形（JWT）は、題名と要約からも伏せる（LLM が使えないときの要約は検索語をそのまま入れる）。
 * ⚠️ 訪問の数（visit_count）・時刻は変えない。使うのは scripts/scrub-browser-history-urls.ts。
 */
import { isSafeSearchQuery, sanitizeVisitUrl } from './url-sanitizer';

export const REDACTED = '（伏せた検索語）';

/** これより短い検索語は、ふつうの言葉を壊しうるので題名と要約では置き換えない */
const MIN_REDACT_LENGTH = 3;
const JWT_LIKE = /eyJ[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]*)*/g;

export interface BrowserFactFields {
  sourceUrl: string | null;
  title: string;
  summary: string | null;
  metadata: unknown;
}

export interface ScrubStats {
  urls: number;
  urlsRemoved: number;
  urlsRewritten: number;
  searchQueriesRemoved: number;
  domainsRemoved: number;
  visitTitlesRedacted: number;
  sourceUrlChanged: boolean;
  textRedacted: boolean;
}

export interface ScrubResult extends BrowserFactFields {
  changed: boolean;
  stats: ScrubStats;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** session-splitter の parseSearchQuery と同じ判定 */
function parseSearchQuery(url: string): string | null {
  try {
    const parsed = new URL(url);
    const isSearchEngine =
      parsed.hostname.includes('google.') ||
      parsed.hostname.includes('bing.com') ||
      parsed.hostname.includes('duckduckgo.com');
    if (!isSearchEngine) return null;
    return parsed.searchParams.get('q') || null;
  } catch {
    return null;
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/** session-splitter の findPrimaryUrl と同じ選び方（検索以外でタイトルが最も長いもの） */
function pickPrimaryUrl(entries: Array<{ url: string; title: string }>): string | null {
  if (entries.length === 0) return null;
  const nonSearch = entries.filter((e) => !parseSearchQuery(e.url));
  if (nonSearch.length > 0) {
    return nonSearch.reduce((best, e) => (e.title.length > best.title.length ? e : best)).url;
  }
  return entries[0].url;
}

function redact(text: string, queries: string[]): string {
  let out = text;
  for (const query of queries) {
    if (query.length < MIN_REDACT_LENGTH) continue;
    out = out.split(query).join(REDACTED);
  }
  return out.replace(JWT_LIKE, REDACTED);
}

export function scrubBrowserFact(fact: BrowserFactFields): ScrubResult {
  const stats: ScrubStats = {
    urls: 0,
    urlsRemoved: 0,
    urlsRewritten: 0,
    searchQueriesRemoved: 0,
    domainsRemoved: 0,
    visitTitlesRedacted: 0,
    sourceUrlChanged: false,
    textRedacted: false,
  };

  let metadata: unknown = fact.metadata;
  const keptEntries: Array<{ url: string; title: string }> = [];
  const removedQueries: string[] = [];

  if (isObject(fact.metadata)) {
    const original = fact.metadata;
    const next: JsonObject = { ...original };
    const hasUrls = Array.isArray(original.urls);

    if (hasUrls) {
      const kept: unknown[] = [];
      for (const entry of original.urls as unknown[]) {
        stats.urls++;
        if (!isObject(entry) || typeof entry.url !== 'string') {
          // 形の分からないものは中身を確かめられないので残さない
          stats.urlsRemoved++;
          continue;
        }
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

    if (Array.isArray(original.search_queries)) {
      // 洗った URL から取り込みと同じ手順で作れる検索語だけを残す（URL が無い古い形なら判定だけ）
      const derived = new Set(
        keptEntries
          .map((e) => parseSearchQuery(e.url))
          .filter((q): q is string => q !== null)
          .map((q) => q.toLowerCase()),
      );
      const queries: string[] = [];
      for (const q of original.search_queries as unknown[]) {
        const keep =
          typeof q === 'string' &&
          isSafeSearchQuery(q.trim()) &&
          (!hasUrls || derived.has(q.toLowerCase()));
        if (keep) {
          queries.push(q);
        } else {
          stats.searchQueriesRemoved++;
          if (typeof q === 'string') removedQueries.push(q);
        }
      }
      next.search_queries = queries;
    }

    // 長い検索語から置き換える（短いものが長いものの一部のとき、長いほうを残さないため）
    removedQueries.sort((a, b) => b.length - a.length);

    // 検索の結果の画面の題名（「<検索語> - Google 検索」）にも、落とした検索語が入る
    if (hasUrls) {
      next.urls = (next.urls as JsonObject[]).map((entry) => {
        if (typeof entry.title !== 'string') return entry;
        const title = redact(entry.title, removedQueries);
        if (title === entry.title) return entry;
        stats.visitTitlesRedacted++;
        return { ...entry, title };
      });
    }

    if (hasUrls && Array.isArray(original.domains)) {
      const hosts = new Set(keptEntries.map((e) => hostnameOf(e.url)).filter(Boolean));
      const domains = (original.domains as unknown[]).filter(
        (d) => typeof d === 'string' && hosts.has(d),
      );
      stats.domainsRemoved = original.domains.length - domains.length;
      next.domains = domains;
    }

    metadata = next;
  }

  let sourceUrl = fact.sourceUrl;
  if (fact.sourceUrl !== null) {
    sourceUrl = sanitizeVisitUrl(fact.sourceUrl) ?? pickPrimaryUrl(keptEntries);
    stats.sourceUrlChanged = sourceUrl !== fact.sourceUrl;
  }

  const title = redact(fact.title, removedQueries);
  const summary = fact.summary === null ? null : redact(fact.summary, removedQueries);
  stats.textRedacted = title !== fact.title || summary !== fact.summary;

  const changed =
    stats.urlsRemoved > 0 ||
    stats.urlsRewritten > 0 ||
    stats.searchQueriesRemoved > 0 ||
    stats.domainsRemoved > 0 ||
    stats.visitTitlesRedacted > 0 ||
    stats.sourceUrlChanged ||
    stats.textRedacted;

  if (!changed) return { ...fact, changed, stats };
  return { sourceUrl, title, summary, metadata, changed, stats };
}
