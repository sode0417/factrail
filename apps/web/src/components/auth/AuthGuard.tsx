'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // hydrationが完了するまで認証チェックをスキップ
    if (!_hasHydrated) return;

    // 未ログインでも閲覧できるページ。/privacy と /terms は OAuth 審査で外部から
    // 参照されるため、認証を挟まず公開する必要がある
    const publicPaths = ['/login', '/auth/callback', '/privacy', '/terms'];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    // 認証済みユーザーがログインページにアクセスした場合、ダッシュボードへリダイレクト
    if (isAuthenticated && pathname === '/login') {
      router.push('/');
      return;
    }

    // 未認証ユーザーが保護されたページにアクセスした場合、ログインページへリダイレクト
    if (!isAuthenticated && !isPublicPath) {
      router.push('/login');
    }
  }, [_hasHydrated, isAuthenticated, pathname, router]);

  // hydration完了前は何も表示しない（画面のちらつきを防ぐ）
  if (!_hasHydrated) {
    return null;
  }

  return <>{children}</>;
}
