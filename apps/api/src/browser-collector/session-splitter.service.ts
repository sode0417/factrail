import { Injectable, Logger } from '@nestjs/common';
import { ChromeVisit } from './chrome-history.service';

export interface BrowsingSession {
  startTime: Date;
  endTime: Date;
  visits: ChromeVisit[];
  domains: string[];
  visitCount: number;
  durationMin: number;
  searchQueries: string[];
  primaryUrl: string;
}

/** セッション分割の閾値（ミリ秒）: 30分 */
const SESSION_GAP_MS = 30 * 60 * 1000;

/** 最小セッションサイズ（これ未満は無視） */
const MIN_SESSION_VISITS = 2;

@Injectable()
export class SessionSplitterService {
  private readonly logger = new Logger(SessionSplitterService.name);

  /**
   * 訪問履歴を時系列でセッション単位に分割する
   */
  splitIntoSessions(visits: ChromeVisit[]): BrowsingSession[] {
    if (visits.length === 0) return [];

    const sorted = [...visits].sort((a, b) => a.visitTime.getTime() - b.visitTime.getTime());

    const sessionGroups: ChromeVisit[][] = [];
    let currentGroup: ChromeVisit[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].visitTime.getTime() - sorted[i - 1].visitTime.getTime();

      if (gap >= SESSION_GAP_MS) {
        sessionGroups.push(currentGroup);
        currentGroup = [sorted[i]];
      } else {
        currentGroup.push(sorted[i]);
      }
    }
    sessionGroups.push(currentGroup);

    const sessions = sessionGroups
      .filter((group) => group.length >= MIN_SESSION_VISITS)
      .map((group) => this.buildSession(group));

    this.logger.log(`${visits.length} 件の訪問を ${sessions.length} セッションに分割しました`);

    return sessions;
  }

  private buildSession(visits: ChromeVisit[]): BrowsingSession {
    const startTime = visits[0].visitTime;
    const endTime = visits[visits.length - 1].visitTime;
    const domains = this.extractDomains(visits);
    const searchQueries = this.extractSearchQueries(visits);
    const primaryUrl = this.findPrimaryUrl(visits);
    const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    return {
      startTime,
      endTime,
      visits,
      domains,
      visitCount: visits.length,
      durationMin: Math.max(durationMin, 1),
      searchQueries,
      primaryUrl,
    };
  }

  private extractDomains(visits: ChromeVisit[]): string[] {
    const domainSet = new Set<string>();
    for (const visit of visits) {
      try {
        const hostname = new URL(visit.url).hostname;
        if (hostname) domainSet.add(hostname);
      } catch {
        // 不正な URL は無視
      }
    }
    return [...domainSet];
  }

  private extractSearchQueries(visits: ChromeVisit[]): string[] {
    const queries: string[] = [];
    const seen = new Set<string>();

    for (const visit of visits) {
      const query = this.parseSearchQuery(visit.url);
      if (query && !seen.has(query.toLowerCase())) {
        seen.add(query.toLowerCase());
        queries.push(query);
      }
    }

    return queries;
  }

  private parseSearchQuery(url: string): string | null {
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

  /**
   * セッションの「主要URL」を決定する
   * 検索エンジン以外の最初の URL、なければタイトルが最も長い URL
   */
  private findPrimaryUrl(visits: ChromeVisit[]): string {
    const nonSearch = visits.filter((v) => !this.parseSearchQuery(v.url));

    if (nonSearch.length > 0) {
      // タイトルが最も長いものを選択（最も情報量が多い）
      return nonSearch.reduce((best, v) => (v.title.length > best.title.length ? v : best)).url;
    }

    return visits[0].url;
  }
}
