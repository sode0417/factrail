'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Spinner, Text, VStack } from '@chakra-ui/react';
import apiClient from '@/lib/axios';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const exchangeCodeForTokens = async () => {
      try {
        const code = searchParams.get('code');

        if (!code) {
          console.error('認証コードが見つかりません');
          router.push('/login');
          return;
        }

        // ワンタイムコードをトークンに交換
        const response = await apiClient.post('/auth/exchange', { code });
        const { user, accessToken, refreshToken, sessionId } = response.data;

        // Zustandストアにログイン情報を保存
        login({
          user,
          accessToken,
          refreshToken,
          sessionId,
        });

        // ダッシュボードへリダイレクト
        router.push('/');
      } catch (error) {
        console.error('認証処理に失敗しました', error);
        router.push('/login');
      }
    };

    exchangeCodeForTokens();
  }, [login, router, searchParams]);

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
