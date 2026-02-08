'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Spinner, Text, VStack } from '@chakra-ui/react';
import apiClient from '@/lib/axios';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function CallbackContent() {
  const router = useRouter();
  const { login } = useAuthStore();

  useEffect(() => {
    const authenticateFromCookie = async () => {
      try {
        // クッキーからトークンを取得
        const tokenResponse = await apiClient.get('/auth/token');
        const { accessToken, refreshToken } = tokenResponse.data;

        if (!accessToken || !refreshToken) {
          console.error('トークンの取得に失敗しました');
          router.push('/login');
          return;
        }

        // ユーザー情報を取得
        const userResponse = await apiClient.get('/auth/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const user = userResponse.data;

        // Zustandストアにログイン情報を保存
        login({
          user,
          accessToken,
          refreshToken,
          sessionId: '', // セッションIDはバックエンドで管理
        });

        // ダッシュボードへリダイレクト
        router.push('/');
      } catch (error) {
        console.error('認証処理に失敗しました', error);
        router.push('/login');
      }
    };

    authenticateFromCookie();
  }, [login, router]);

  return (
    <VStack minH="100vh" justify="center" bg="gray.900">
      <Spinner size="xl" color="blue.500" />
      <Text color="gray.400">認証処理中...</Text>
    </VStack>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <VStack minH="100vh" justify="center" bg="gray.900">
          <Spinner size="xl" color="blue.500" />
        </VStack>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
