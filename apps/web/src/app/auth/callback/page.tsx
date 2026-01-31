'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Spinner, Text, VStack } from '@chakra-ui/react';
import apiClient from '@/lib/axios';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      const fetchUser = async () => {
        try {
          const response = await apiClient.get('/auth/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const user = response.data;

          login({
            user,
            accessToken,
            refreshToken,
            sessionId: '', // セッションIDはバックエンドで管理
          });

          router.push('/');
        } catch (error) {
          console.error('ユーザー情報の取得に失敗しました', error);
          router.push('/login');
        }
      };

      fetchUser();
    } else {
      router.push('/login');
    }
  }, [searchParams, login, router]);

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
