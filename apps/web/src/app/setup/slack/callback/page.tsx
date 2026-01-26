'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  VStack,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Icon,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app';

function SlackCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleCallback = async (code: string) => {
    try {
      const response = await fetch(`${API_URL}/integrations/slack/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        setStatus('success');
        // 3秒後に設定ページにリダイレクト
        setTimeout(() => {
          router.push('/setup/slack');
        }, 3000);
      } else {
        const data = await response.json();
        throw new Error(data.message || '連携に失敗しました');
      }
    } catch (error) {
      console.error('Slack callback error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '連携に失敗しました');
    }
  };

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const receivedState = searchParams.get('state');

    if (error) {
      setStatus('error');
      setErrorMessage(`認証がキャンセルされました: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('認証コードが見つかりません');
      return;
    }

    // CSRF保護: stateパラメータを検証
    const storedState = sessionStorage.getItem('slack_oauth_state');
    if (!receivedState || !storedState || receivedState !== storedState) {
      setStatus('error');
      setErrorMessage('セキュリティ検証に失敗しました。もう一度お試しください。');
      sessionStorage.removeItem('slack_oauth_state');
      return;
    }

    // 検証成功後、stateを削除
    sessionStorage.removeItem('slack_oauth_state');

    // バックエンドにコードを送信
    handleCallback(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    router.push('/setup/slack');
  };

  return (
    <VStack spacing={6} align="stretch" maxW="600px">
      {status === 'loading' && (
        <Box textAlign="center" py={12}>
          <Spinner size="xl" color="brand.500" mb={4} />
          <Text fontSize="lg" color="gray.400">
            Slackとの連携を処理しています...
          </Text>
        </Box>
      )}

      {status === 'success' && (
        <Alert
          status="success"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          bg="gray.800"
          borderColor="green.500"
          borderWidth="1px"
          borderRadius="lg"
          py={8}
        >
          <Icon as={FiCheckCircle} boxSize={12} color="green.500" mb={4} />
          <AlertTitle fontSize="2xl" mb={2}>
            連携成功！
          </AlertTitle>
          <AlertDescription fontSize="md" color="gray.400">
            Slackワークスペースとの連携が完了しました。
            <br />
            3秒後に設定ページに戻ります...
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert
          status="error"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          bg="gray.800"
          borderColor="red.500"
          borderWidth="1px"
          borderRadius="lg"
          py={8}
        >
          <Icon as={FiXCircle} boxSize={12} color="red.500" mb={4} />
          <AlertTitle fontSize="2xl" mb={2}>
            連携エラー
          </AlertTitle>
          <AlertDescription fontSize="md" color="gray.400" mb={4}>
            {errorMessage}
          </AlertDescription>
          <Button colorScheme="brand" onClick={handleRetry}>
            設定ページに戻る
          </Button>
        </Alert>
      )}
    </VStack>
  );
}

export default function SlackCallbackPage() {
  return (
    <MainLayout title="Slack連携" subtitle="認証を処理中">
      <Suspense
        fallback={
          <Box textAlign="center" py={12}>
            <Spinner size="xl" color="brand.500" mb={4} />
            <Text fontSize="lg" color="gray.400">
              読み込み中...
            </Text>
          </Box>
        }
      >
        <SlackCallbackContent />
      </Suspense>
    </MainLayout>
  );
}
