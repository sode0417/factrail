// Prisma 7: CLI（migrate・db push）の接続先はここで渡す。.env は自分で読む。
// 移行は直接の接続（DIRECT_URL）で行い、無ければ DATABASE_URL を使う。
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
