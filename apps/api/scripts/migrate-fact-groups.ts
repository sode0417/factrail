/**
 * 既存の GitHub Fact にグループ情報を付与するマイグレーションスクリプト
 *
 * 実行方法:
 *   cd apps/api
 *   npx ts-node scripts/migrate-fact-groups.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function buildGroupId(
  repo: string,
  type: 'issue' | 'pull_request' | 'push',
  identifier: string,
): string {
  return `github:${repo}:${type}:${identifier}`;
}

async function migrateFactGroups() {
  console.log('既存 Fact のグループマイグレーションを開始...');

  // GitHub ソースの Fact を全件取得
  const facts = await prisma.fact.findMany({
    where: { source: 'github', groupId: null },
    orderBy: { occurredAt: 'asc' },
  });

  console.log(`対象 Fact 数: ${facts.length}`);

  let updated = 0;
  const groupParents: Record<string, string> = {};

  for (const fact of facts) {
    let groupId: string | undefined;
    let groupType: string | undefined;
    let newExternalId: string | undefined;

    if (fact.type.startsWith('issue.')) {
      // issue イベント: externalId = "repo#number" → "repo#issue{number}:{action}"
      const match = fact.externalId.match(/^(.+)#(\d+)$/);
      if (match) {
        const [, repo, number] = match;
        const action = fact.type.replace('issue.', '');
        newExternalId = `${repo}#issue${number}:${action}`;
        groupId = buildGroupId(repo, 'issue', number);
        groupType = 'issue';
      }
    } else if (fact.type.startsWith('pull_request.')) {
      // PR イベント: externalId = "repo#number" → "repo#pr{number}:{action}"
      const match = fact.externalId.match(/^(.+)#(\d+)$/);
      if (match) {
        const [, repo, number] = match;
        const action = fact.type.replace('pull_request.', '');
        newExternalId = `${repo}#pr${number}:${action}`;
        groupId = buildGroupId(repo, 'pull_request', number);
        groupType = 'pull_request';
      }
    } else if (fact.type === 'push.commit') {
      // push コミット: externalId はそのまま
      const metadata = fact.metadata as Record<string, unknown> | null;
      const repo = metadata?.repository as string;
      const branch = metadata?.branch as string;
      if (repo && branch) {
        const date = fact.occurredAt.toISOString().slice(0, 10);
        groupId = buildGroupId(repo, 'push', `${branch}:${date}`);
        groupType = 'push';
      }
    }

    if (!groupId) continue;

    // 親の決定
    let parentId: string | null = null;
    if (groupParents[groupId]) {
      parentId = groupParents[groupId];
    } else {
      groupParents[groupId] = fact.id;
    }

    const updateData: Record<string, unknown> = { groupId, groupType };
    if (parentId) updateData.parentId = parentId;
    if (newExternalId) updateData.externalId = newExternalId;

    try {
      await prisma.fact.update({
        where: { id: fact.id },
        data: updateData,
      });
      updated++;
    } catch (error) {
      // externalId のユニーク制約違反（同じアクションが既に存在）はスキップ
      console.warn(`Fact ${fact.id} の更新をスキップ: ${(error as Error).message}`);
    }
  }

  console.log(`マイグレーション完了: ${updated}/${facts.length} 件を更新`);
}

migrateFactGroups()
  .catch((error) => {
    console.error('マイグレーションエラー:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
