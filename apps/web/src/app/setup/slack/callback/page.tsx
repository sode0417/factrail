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
import apiClient from '@/lib/axios';

function SlackCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // バックエンドへの問い合わせの結果だけを state で持つ
  const [postStatus, setPostStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [postErrorMessage, setPostErrorMessage] = useState<string>('');

  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const state = searchParams.get('state');

  // ⭐ URL のパラメータだけで決まるエラーは、描画時に求められる。
  //    以前は effect の中で setState していたが、それは「描画で計算できるものを
  //    状態にしていた」だけで、カスケード再描画の原因になっていた
  //    (react-hooks/set-state-in-effect)。
  const paramErrorMessage = oauthError
    ? `認証がキャンセルされました: ${oauthError}`
    : !code || !state
      ? '認証コードまたはstateパラメータが見つかりません'
      : null;

  const status = paramErrorMessage ? 'error' : postStatus;
  const errorMessage = paramErrorMessage ?? postErrorMessage;

  useEffect(() => {
    // URL の時点で決着しているなら、通信は行わない
    if (paramErrorMessage) return;

    // ⭐ 状態の更新は通信の応答が返ってから（＝外部の出来事）行う。
    //    effect の同期本体では setState しない。
    let cancelled = false;
    void (async () => {
      try {
        // バックエンドにcode + stateを送信（stateの検証はバックエンド側で実施）
        await apiClient.post('/integrations/slack/callback', { code, state });
        if (cancelled) return;
        setPostStatus('success');
        // 3秒後に設定ページにリダイレクト
        setTimeout(() => {
          router.push('/setup/slack');
        }, 3000);
      } catch (error: unknown) {
        console.error('Slack callback error:', error);
        if (cancelled) return;
        setPostStatus('error');
        const axiosError = error as { response?: { data?: { message?: string } } };
        setPostErrorMessage(
          axiosError?.response?.data?.message ||
            (error instanceof Error ? error.message : '連携に失敗しました'),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
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
          <Text fontSize="lg" color="text.muted">
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
          bg="bg.surface"
          borderColor="green.500"
          borderWidth="1px"
          borderRadius="lg"
          py={8}
        >
          <Icon as={FiCheckCircle} boxSize={12} color="green.500" mb={4} />
          <AlertTitle fontSize="2xl" mb={2}>
            連携成功！
          </AlertTitle>
          <AlertDescription fontSize="md" color="text.muted">
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
          bg="bg.surface"
          borderColor="red.500"
          borderWidth="1px"
          borderRadius="lg"
          py={8}
        >
          <Icon as={FiXCircle} boxSize={12} color="red.500" mb={4} />
          <AlertTitle fontSize="2xl" mb={2}>
            連携エラー
          </AlertTitle>
          <AlertDescription fontSize="md" color="text.muted" mb={4}>
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
            <Text fontSize="lg" color="text.muted">
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
