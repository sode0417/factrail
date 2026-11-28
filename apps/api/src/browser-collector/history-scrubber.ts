/**
 * 保存済みのブラウザの Fact（browser.research）を、#178 の基準で洗う（#262 より前に保存した分）。
 *
 * ⭐ URL の判定は取り込みのときと同じ sanitizeVisitUrl を使う。検索語・ドメイン・主要 URL は、
 *    洗った URL から取り込みと同じ手順（session-splitter）で作り直し、前からあったものとの共通部分だけを残す。
 *    基準を二重に持たないため。
 * ⭐ 鍵の形の検索語（isSafeSearchQuery が偽）と、鍵の形の文字の並び（JWT・取り込みと同じ「長い切れ目のない並び」）は、
 *    Fact の題名・要約と訪問の題名からも伏せる（LLM が使えないときの要約は検索語をそのまま入れる）。
 *    大文字小文字と前後の空白は区別しない。
 * ⚠️ 鍵の形でない語（地図の住所など、検索の結果の画面以外の q）は検索語の一覧から外すだけで、文章は伏せない。
 *    短い語を部分文字列で置き換えると、ふつうの題名を壊すため（"the" → "theory"）。
 * ⚠️ 訪問の数（visit_count）・時刻は変えない。使うのは scripts/scrub-browser-history-urls.ts。
 */
import { isSafeSearchQuery, LONG_RUN, sanitizeVisitUrl, TOKEN_PART_LENGTH } from './url-sanitizer';

export const REDACTED = '（伏せた鍵）';

/** これより短い語は、ふつうの言葉を壊しうるので置き換えない */
const MIN_REDACT_LENGTH = 6;
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 鍵の形の語を、大文字小文字を区別せず、長いものから伏せる */
function redact(text: string, secretTerms: string[]): string {
  let out = text;
  for (const term of secretTerms) {
    out = out.replace(new RegExp(escapeRegExp(term), 'gi'), REDACTED);
  }
  out = out.replace(JWT_LIKE, REDACTED);
  // 取り込みの isSafeSearchQuery と同じ基準: 区切りの間が長い並びは鍵とみなす（途中で切れた鍵にも効く）
  return out.replace(LONG_RUN, (run) =>
    run.split(/[-._/]/).some((part) => part.length >= TOKEN_PART_LENGTH) ? REDACTED : run,
  );
}

/** 鍵の形の語を集める（重複は大文字小文字を区別せずに除き、長いものから並べる） */
function collectSecretTerms(candidates: unknown[]): string[] {
  const terms = new Map<string, string>();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const term = candidate.trim();
    if (term.length < MIN_REDACT_LENGTH || isSafeSearchQuery(term)) continue;
    terms.set(term.toLowerCase(), term);
  }
  return [...terms.values()].sort((a, b) => b.length - a.length);
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
  const secretCandidates: unknown[] = [];

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
        secretCandidates.push(parseSearchQuery(entry.url));
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
          secretCandidates.push(q);
        }
      }
      next.search_queries = queries;
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

  const secretTerms = collectSecretTerms(secretCandidates);

  // 訪問の題名（検索の結果の画面なら「<検索語> - Google 検索」）にも、鍵が入りうる
  if (isObject(metadata) && Array.isArray(metadata.urls)) {
    metadata.urls = metadata.urls.map((entry: unknown) => {
      if (!isObject(entry) || typeof entry.title !== 'string') return entry;
      const title = redact(entry.title, secretTerms);
      if (title === entry.title) return entry;
      stats.visitTitlesRedacted++;
      return { ...entry, title };
    });
  }

  let sourceUrl = fact.sourceUrl;
  if (fact.sourceUrl !== null) {
    sourceUrl = sanitizeVisitUrl(fact.sourceUrl) ?? pickPrimaryUrl(keptEntries);
    stats.sourceUrlChanged = sourceUrl !== fact.sourceUrl;
  }

  const title = redact(fact.title, secretTerms);
  const summary = fact.summary === null ? null : redact(fact.summary, secretTerms);
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
