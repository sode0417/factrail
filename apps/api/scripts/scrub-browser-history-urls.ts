/**
 * 保存済みのブラウザの Fact から、認証の URL と、クエリ・# の後ろの機微な情報を洗い落とす（#178）。
 * 取り込みのときの基準（#262 の url-sanitizer）と同じ基準で、#262 より前に保存した分を直す。
 *
 * 実行方法（apps/api で）:
 *   npx ts-node scripts/scrub-browser-history-urls.ts            # 数えるだけ（書き込まない）
 *   npx ts-node scripts/scrub-browser-history-urls.ts --apply    # 控えを取ってから書き換える
 *   npx ts-node scripts/scrub-browser-history-urls.ts --restore  # 控えから書き戻す
 *
 * ⭐ 出すのは件数だけ。URL や検索語の値は画面に出さない。
 * ⭐ --apply は 1 つのトランザクションで「控えの表に元の行を写す → 書き換える → もう一度洗って 0 件か確かめる」。
 *    どこかで失敗すれば全部が戻る。控えは factrail.browser_url_scrub_backups に残し、--restore で書き戻せる。
 *    同じ Fact の控えは最初の 1 回の分だけを持つ（2 回流しても元の値は消えない）。
 * ⚠️ 変えるのは source_url と metadata（urls・search_queries）だけ。訪問の数・時刻・要約は変えない。
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { scrubBrowserFact, ScrubResult } from '../src/browser-collector/history-scrubber';

const BACKUP_TABLE = 'factrail.browser_url_scrub_backups';
const prisma = new PrismaClient();

type Mode = 'dry-run' | 'apply' | 'restore';

function parseMode(argv: string[]): Mode {
  const flags = argv.filter((a) => a.startsWith('--'));
  if (flags.length === 0) return 'dry-run';
  if (flags.length === 1 && flags[0] === '--apply') return 'apply';
  if (flags.length === 1 && flags[0] === '--restore') return 'restore';
  throw new Error(`分からない引数です: ${flags.join(' ')}（--apply か --restore のどちらか 1 つ）`);
}

interface Totals {
  facts: number;
  factsChanged: number;
  urls: number;
  urlsRemoved: number;
  urlsRewritten: number;
  searchQueriesRemoved: number;
  sourceUrlChanged: number;
  sourceUrlNulled: number;
}

type BrowserFact = { id: string; sourceUrl: string | null; metadata: Prisma.JsonValue };

function summarize(facts: BrowserFact[]): {
  totals: Totals;
  changes: Array<{ fact: BrowserFact; result: ScrubResult }>;
} {
  const totals: Totals = {
    facts: facts.length,
    factsChanged: 0,
    urls: 0,
    urlsRemoved: 0,
    urlsRewritten: 0,
    searchQueriesRemoved: 0,
    sourceUrlChanged: 0,
    sourceUrlNulled: 0,
  };
  const changes: Array<{ fact: BrowserFact; result: ScrubResult }> = [];

  for (const fact of facts) {
    const result = scrubBrowserFact(fact.sourceUrl, fact.metadata);
    totals.urls += result.stats.urls;
    totals.urlsRemoved += result.stats.urlsRemoved;
    totals.urlsRewritten += result.stats.urlsRewritten;
    totals.searchQueriesRemoved += result.stats.searchQueriesRemoved;
    if (result.stats.sourceUrlChanged) totals.sourceUrlChanged++;
    if (fact.sourceUrl !== null && result.sourceUrl === null) totals.sourceUrlNulled++;
    if (result.changed) {
      totals.factsChanged++;
      changes.push({ fact, result });
    }
  }
  return { totals, changes };
}

function printTotals(label: string, t: Totals): void {
  console.log(`[${label}]`);
  console.log(`  ブラウザの Fact: ${t.facts} 件（書き換える: ${t.factsChanged} 件）`);
  console.log(
    `  URL: ${t.urls} 本（取り除く: ${t.urlsRemoved} 本・クエリか # を落とす: ${t.urlsRewritten} 本）`,
  );
  console.log(`  検索語を落とす: ${t.searchQueriesRemoved} 個`);
  console.log(
    `  主要 URL を変える: ${t.sourceUrlChanged} 件（うち残る URL が無く空にする: ${t.sourceUrlNulled} 件）`,
  );
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

async function loadBrowserFacts(client: Prisma.TransactionClient | PrismaClient) {
  return client.fact.findMany({
    where: { source: 'browser' },
    select: { id: true, sourceUrl: true, metadata: true },
    orderBy: { occurredAt: 'asc' },
  });
}

async function dryRun(): Promise<void> {
  const { totals } = summarize(await loadBrowserFacts(prisma));
  printTotals('数えるだけ（書き込んでいません）', totals);
}

async function apply(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const { totals, changes } = summarize(await loadBrowserFacts(tx));
      printTotals('書き換える前', totals);

      await tx.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
          fact_id      text PRIMARY KEY REFERENCES factrail.facts(id) ON DELETE CASCADE,
          source_url   text,
          metadata     jsonb,
          backed_up_at timestamptz NOT NULL DEFAULT now()
        )`);

      let backedUp = 0;
      for (const { fact, result } of changes) {
        backedUp += await tx.$executeRaw`
          INSERT INTO factrail.browser_url_scrub_backups (fact_id, source_url, metadata)
          VALUES (${fact.id}, ${fact.sourceUrl}, ${fact.metadata === null ? null : JSON.stringify(fact.metadata)}::jsonb)
          ON CONFLICT (fact_id) DO NOTHING`;
        await tx.fact.update({
          where: { id: fact.id },
          data: { sourceUrl: result.sourceUrl, metadata: toJsonInput(result.metadata) },
        });
      }
      console.log(`  控えに写した: ${backedUp} 件（前に控えがあった分は写さず、最初の控えを残す）`);

      const after = summarize(await loadBrowserFacts(tx));
      if (after.totals.factsChanged !== 0) {
        throw new Error(
          `書き換えたあとも洗える Fact が ${after.totals.factsChanged} 件残っています。全部を戻します`,
        );
      }
      printTotals('書き換えた後（もう一度洗って 0 件）', after.totals);
    },
    { timeout: 300_000, maxWait: 10_000 },
  );
  console.log('書き換えました。戻すときは --restore を流してください。');
}

async function restore(): Promise<void> {
  const [{ exists }] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('factrail.browser_url_scrub_backups') IS NOT NULL AS exists`;
  if (!exists) {
    console.log('控えの表がありません。書き戻すものはありません。');
    return;
  }
  const restored = await prisma.$executeRaw`
    UPDATE factrail.facts AS f
       SET source_url = b.source_url, metadata = b.metadata
      FROM factrail.browser_url_scrub_backups AS b
     WHERE f.id = b.fact_id`;
  console.log(`控えから書き戻しました: ${restored} 件（控えの表は残しています）`);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (mode === 'dry-run') await dryRun();
  if (mode === 'apply') await apply();
  if (mode === 'restore') await restore();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
