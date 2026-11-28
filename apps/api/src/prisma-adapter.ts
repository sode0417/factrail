import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7 の driver adapter（PostgreSQL）を作る。
 *
 * - DATABASE_URL が無いと pg は PG* 環境変数や localhost に黙って切り替えるため、ここで止める
 * - pg Pool の既定は接続タイムアウト無制限なので、Prisma 6 と同じ 5 秒を明示する
 * - 接続 URL の ?schema= は adapter では効かない（モデルは @@schema で指定している）
 */
export function createPgAdapter(connectionString = process.env.DATABASE_URL): PrismaPg {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 });
}
