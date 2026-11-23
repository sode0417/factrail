/**
 * 保存済みのブラウザの Fact から、認証の URL と、クエリ・# の後ろの機微な情報を洗い落とす（#178）。
 * 取り込みのときの基準（#262 の url-sanitizer）と同じ基準で、#262 より前に保存した分を直す。
 *
 * 実行方法（apps/api で）:
 *   npx ts-node scripts/scrub-browser-history-urls.ts                # 数えるだけ（書き込まない）
 *   npx ts-node scripts/scrub-browser-history-urls.ts --apply        # 控えを取ってから書き換える
 *   npx ts-node scripts/scrub-browser-history-urls.ts --restore      # 控えから書き戻す
 *   npx ts-node scripts/scrub-browser-history-urls.ts --drop-backup  # 控えの表を消す
 *
 * ⭐ 出すのは件数だけ。URL・検索語・題名の値は画面に出さない（エラーも種類だけを出す）。
 * ⭐ --apply は 1 つのトランザクションで「控えの表に元の行を写す → 書き換える → もう一度洗って 0 件か確かめる」。
 *    どこかで失敗すれば全部が戻る。同じ Fact の控えは最初の 1 回の分だけを持つ（2 回流しても元の値は消えない）。
 * ⚠️ 控えの表 factrail.browser_url_scrub_backups には、洗う前の秘密がそのまま入る。
 *    書き換えたあと画面で確かめ、問題が無ければ 7 日以内に --drop-backup で消す（消すと戻せない）。
 *    この表は schema.prisma に無いので、本番で prisma db push を流すと黙って消える。
 * ⚠️ 変えるのは source_url・題名・要約・metadata（urls・search_queries・domains）だけ。訪問の数・時刻は変えない。
 * ⭐ 長いトランザクションになるので、DIRECT_URL（プールを通らない接続）があればそちらを使う。
 */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { scrubBrowserFact, ScrubResult } from '../src/browser-collector/history-scrubber';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

type Mode = 'dry-run' | 'apply' | 'restore' | 'drop-backup';
const FLAGS: Record<string, Mode> = {
  '--apply': 'apply',
  '--restore': 'restore',
  '--drop-backup': 'drop-backup',
};

function parseMode(argv: string[]): Mode {
  const flags = argv.filter((a) => a.startsWith('--'));
  if (flags.length === 0) return 'dry-run';
  if (flags.length === 1 && FLAGS[flags[0]]) return FLAGS[flags[0]];
  throw new Error(`分からない引数です（--apply・--restore・--drop-backup のどれか 1 つ）`);
}

interface Totals {
  facts: number;
  factsChanged: number;
  urls: number;
  urlsRemoved: number;
  urlsRewritten: number;
  searchQueriesRemoved: number;
  domainsRemoved: number;
  visitTitlesRedacted: number;
  sourceUrlChanged: number;
  sourceUrlNulled: number;
  textRedacted: number;
}

type BrowserFact = {
  id: string;
  sourceUrl: string | null;
  title: string;
  summary: string | null;
  metadata: Prisma.JsonValue;
};

function summarize(facts: BrowserFact[]) {
  const totals: Totals = {
    facts: facts.length,
    factsChanged: 0,
    urls: 0,
    urlsRemoved: 0,
    urlsRewritten: 0,
    searchQueriesRemoved: 0,
    domainsRemoved: 0,
    visitTitlesRedacted: 0,
    sourceUrlChanged: 0,
    sourceUrlNulled: 0,
    textRedacted: 0,
  };
  const changes: Array<{ fact: BrowserFact; result: ScrubResult }> = [];

  for (const fact of facts) {
    const result = scrubBrowserFact(fact);
    const s = result.stats;
    totals.urls += s.urls;
    totals.urlsRemoved += s.urlsRemoved;
    totals.urlsRewritten += s.urlsRewritten;
    totals.searchQueriesRemoved += s.searchQueriesRemoved;
    totals.domainsRemoved += s.domainsRemoved;
    totals.visitTitlesRedacted += s.visitTitlesRedacted;
    if (s.sourceUrlChanged) totals.sourceUrlChanged++;
    if (fact.sourceUrl !== null && result.sourceUrl === null) totals.sourceUrlNulled++;
    if (s.textRedacted) totals.textRedacted++;
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
  console.log(
    `  検索語を落とす: ${t.searchQueriesRemoved} 個・ドメインを落とす: ${t.domainsRemoved} 個`,
  );
  console.log(
    `  主要 URL を変える: ${t.sourceUrlChanged} 件（うち残る URL が無く空にする: ${t.sourceUrlNulled} 件）`,
  );
  console.log(
    `  題名か要約の検索語・鍵を伏せる: ${t.textRedacted} 件・訪問の題名を伏せる: ${t.visitTitlesRedacted} 本`,
  );
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function loadBrowserFacts(client: Prisma.TransactionClient | PrismaClient): Promise<BrowserFact[]> {
  return client.fact.findMany({
    where: { source: 'browser' },
    select: { id: true, sourceUrl: true, title: true, summary: true, metadata: true },
    orderBy: { occurredAt: 'asc' },
  });
}

async function backupTableExists(): Promise<boolean> {
  const [{ exists }] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('factrail.browser_url_scrub_backups') IS NOT NULL AS exists`;
  return exists;
}

async function dryRun(): Promise<void> {
  const { totals } = summarize(await loadBrowserFacts(prisma));
  printTotals('数えるだけ（書き込んでいません）', totals);
  if (await backupTableExists()) console.log('  控えの表があります（前に --apply を流しています）');
}

async function apply(): Promise<void> {
  // ⚠️ 表はトランザクションの外で先に作る。外部キーも付けない（facts の書き込みを長く止めないため）
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS factrail.browser_url_scrub_backups (
      fact_id      text PRIMARY KEY,
      source_url   text,
      title        text NOT NULL,
      summary      text,
      metadata     jsonb,
      backed_up_at timestamptz NOT NULL DEFAULT now()
    )`);

  await prisma.$transaction(
    async (tx) => {
      const { totals, changes } = summarize(await loadBrowserFacts(tx));
      printTotals('書き換える前', totals);

      let backedUp = 0;
      for (const { fact, result } of changes) {
        const metadataJson = fact.metadata === null ? null : JSON.stringify(fact.metadata);
        backedUp += await tx.$executeRaw`
          INSERT INTO factrail.browser_url_scrub_backups (fact_id, source_url, title, summary, metadata)
          VALUES (${fact.id}, ${fact.sourceUrl}, ${fact.title}, ${fact.summary}, ${metadataJson}::jsonb)
          ON CONFLICT (fact_id) DO NOTHING`;
        await tx.fact.update({
          where: { id: fact.id },
          data: {
            sourceUrl: result.sourceUrl,
            title: result.title,
            summary: result.summary,
            metadata: toJsonInput(result.metadata),
          },
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
    { timeout: 600_000, maxWait: 10_000 },
  );
  console.log('書き換えました。戻すときは --restore、確かめ終えたら 7 日以内に --drop-backup。');
}

async function restore(): Promise<void> {
  if (!(await backupTableExists())) {
    console.log('控えの表がありません。書き戻すものはありません。');
    return;
  }
  const restored = await prisma.$executeRaw`
    UPDATE factrail.facts AS f
       SET source_url = b.source_url, title = b.title, summary = b.summary, metadata = b.metadata
      FROM factrail.browser_url_scrub_backups AS b
     WHERE f.id = b.fact_id AND f.source = 'browser'`;
  console.log(`控えから書き戻しました: ${restored} 件（控えの表は残しています）`);
}

async function dropBackup(): Promise<void> {
  if (!(await backupTableExists())) {
    console.log('控えの表はありません。');
    return;
  }
  const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) AS count FROM factrail.browser_url_scrub_backups`;
  await prisma.$executeRawUnsafe('DROP TABLE factrail.browser_url_scrub_backups');
  console.log(`控えの表を消しました（${count} 件）。もう書き戻せません。`);
}

function describeError(error: unknown): string {
  // ⚠️ Prisma の検証エラーは引数（URL や題名）を含むので、種類とコードだけを出す
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `${error.name} ${error.code}`;
  if (error instanceof Error && error.name.startsWith('PrismaClient')) return error.name;
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (mode === 'dry-run') await dryRun();
  if (mode === 'apply') await apply();
  if (mode === 'restore') await restore();
  if (mode === 'drop-backup') await dropBackup();
}

main()
  .catch((error) => {
    console.error(`失敗しました: ${describeError(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
