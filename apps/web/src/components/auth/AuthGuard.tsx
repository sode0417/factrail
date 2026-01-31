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

    const publicPaths = ['/login', '/auth/callback'];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

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
