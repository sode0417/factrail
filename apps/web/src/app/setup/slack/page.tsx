'use client';

import {
  Box,
  Card,
  CardBody,
  CardHeader,
  VStack,
  HStack,
  Flex,
  Text,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Code,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Icon,
  useClipboard,
  IconButton,
  Tooltip,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiMessageSquare, FiCopy, FiCheck, FiExternalLink, FiSave } from 'react-icons/fi';
import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/axios';

interface SettingResponse {
  id: string;
  provider: string;
  settingType: string;
  hasValue: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationResponse {
  id: string;
  provider: string;
  accountId: string;
  accountName: string | null;
  status: string;
  hasAccessToken: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SlackSetupPage() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [targetChannelId, setTargetChannelId] = useState('');
  const [isClientIdConfigured, setIsClientIdConfigured] = useState(false);
  const [isClientSecretConfigured, setIsClientSecretConfigured] = useState(false);
  const [isChannelIdConfigured, setIsChannelIdConfigured] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAccountName, setConnectedAccountName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/setup/slack/callback`
    : '';
  
  const { hasCopied, onCopy } = useClipboard(redirectUri);

  // 設定状態を取得
  const fetchSettings = useCallback(async () => {
    try {
      const response = await apiClient.get<SettingResponse[]>('/settings', {
        params: { provider: 'slack' },
      });
      const data = response.data;
      const clientIdSetting = data.find(s => s.settingType === 'client_id');
      const clientSecretSetting = data.find(s => s.settingType === 'client_secret');
      const channelIdSetting = data.find(s => s.settingType === 'target_channel_id');
      setIsClientIdConfigured(!!clientIdSetting?.hasValue);
      setIsClientSecretConfigured(!!clientSecretSetting?.hasValue);
      setIsChannelIdConfigured(!!channelIdSetting?.hasValue);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, []);

  // 連携状態を取得
  const fetchIntegrations = useCallback(async () => {
    try {
      const response = await apiClient.get<{ data: IntegrationResponse[] }>('/integrations', {
        params: { provider: 'slack' },
      });
      const data = response.data.data;
      if (data.length > 0 && data[0].status === 'active') {
        setIsConnected(true);
        setConnectedAccountName(data[0].accountName || 'Unknown Workspace');
      } else {
        setIsConnected(false);
        setConnectedAccountName('');
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchSettings(), fetchIntegrations()]);
      setIsLoading(false);
    };
    fetchData();
  }, [fetchSettings, fetchIntegrations]);

  const saveClientId = async () => {
    if (!clientId) {
      toast({
        title: 'Client IDを入力してください',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/settings', {
        provider: 'slack',
        settingType: 'client_id',
        value: clientId,
      });
      toast({
        title: 'Client IDを保存しました',
        status: 'success',
        duration: 3000,
      });
      setIsClientIdConfigured(true);
      setClientId('');
    } catch (error) {
      console.error('Failed to save client ID:', error);
      toast({
        title: '保存に失敗しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveClientSecret = async () => {
    if (!clientSecret) {
      toast({
        title: 'Client Secretを入力してください',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/settings', {
        provider: 'slack',
        settingType: 'client_secret',
        value: clientSecret,
      });
      toast({
        title: 'Client Secretを保存しました',
        status: 'success',
        duration: 3000,
      });
      setIsClientSecretConfigured(true);
      setClientSecret('');
    } catch (error) {
      console.error('Failed to save client secret:', error);
      toast({
        title: '保存に失敗しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveTargetChannelId = async () => {
    if (!targetChannelId) {
      toast({
        title: '送信先IDを入力してください',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/settings', {
        provider: 'slack',
        settingType: 'target_channel_id',
        value: targetChannelId,
      });
      toast({
        title: '送信先IDを保存しました',
        status: 'success',
        duration: 3000,
      });
      setIsChannelIdConfigured(true);
      setTargetChannelId('');
    } catch (error) {
      console.error('Failed to save target channel ID:', error);
      toast({
        title: '保存に失敗しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOAuthConnect = async () => {
    if (!isClientIdConfigured && !clientId) {
      toast({
        title: 'Client IDを入力してください',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    if (!isClientSecretConfigured) {
      toast({
        title: 'Client Secretを先に保存してください',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    // 入力されたClient IDまたは設定済みの場合は入力を求める
    const useClientId = clientId || prompt('Client IDを入力してください（設定画面で保存したClient ID）');
    if (!useClientId) {
      return;
    }

    // バックエンドから署名付きstateを取得（ユーザーIDが埋め込まれる）
    try {
      const stateResponse = await apiClient.get<{ state: string }>('/integrations/slack/oauth-state');
      const state = stateResponse.data.state;

      const scopes = 'chat:write,users:read';
      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${useClientId}&scope=${scopes}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get OAuth state:', error);
      toast({
        title: 'OAuth状態の取得に失敗しました。ログインしているか確認してください。',
        status: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <MainLayout title="Slack連携" subtitle="Slack DM/チャンネルへの自動投稿を設定">
      <Box px={{ base: 3, md: 6, lg: 8 }} maxW="1600px" mx="auto" w="100%">
      <VStack spacing={6} align="stretch">
        {/* Status Card */}
        <Card bg="bg.surface" borderColor="border.muted" borderWidth="1px">
          <CardBody>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={{ base: 3, md: 0 }}>
              <HStack spacing={4}>
                <Box p={3} borderRadius="lg" bg="bg.surface-2" border="1px solid" borderColor="border.muted">
                  <Icon as={FiMessageSquare} boxSize={6} color="#4A154B" />
                </Box>
                <Box>
                  <Text fontWeight="semibold" fontSize="lg">
                    Slack OAuth
                  </Text>
                  <Text fontSize="sm" color="text.muted">
                    {isConnected && connectedAccountName
                      ? `連携中: ${connectedAccountName}`
                      : 'DM/チャンネルへの自動投稿を有効化'}
                  </Text>
                </Box>
              </HStack>
              {isLoading ? (
                <Spinner size="sm" />
              ) : (
                <Badge
                  colorScheme={isConnected ? 'green' : isClientIdConfigured && isClientSecretConfigured ? 'blue' : 'yellow'}
                  fontSize="sm"
                  px={3}
                  py={1}
                >
                  {isConnected ? '接続済み' : isClientIdConfigured && isClientSecretConfigured ? '設定済み' : '未設定'}
                </Badge>
              )}
            </Flex>
          </CardBody>
        </Card>

        {/* Setup Instructions */}
        <Card bg="bg.surface" borderColor="border.muted" borderWidth="1px">
          <CardHeader>
            <Text fontSize="lg" fontWeight="semibold">
              セットアップ手順
            </Text>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              {/* Step 1 */}
              <Box>
                <HStack mb={3}>
                  <Box
                    w={6}
                    h={6}
                    borderRadius="full"
                    bg="brand.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="sm" fontWeight="bold" color="white">
                      1
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">Slack Appを作成</Text>
                </HStack>
                <VStack align="stretch" spacing={3} pl={9}>
                  <Text fontSize="sm" color="text.muted">
                    1. Slack API → Your Apps → Create New App
                  </Text>
                  <Text fontSize="sm" color="text.muted">
                    2. 「From scratch」を選択
                  </Text>
                  <Text fontSize="sm" color="text.muted">
                    3. App名を入力してワークスペースを選択
                  </Text>
                </VStack>
              </Box>

              <Divider borderColor="border.muted" />

              {/* Step 2 */}
              <Box>
                <HStack mb={3}>
                  <Box
                    w={6}
                    h={6}
                    borderRadius="full"
                    bg="brand.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="sm" fontWeight="bold" color="white">
                      2
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">OAuth & Permissions を設定</Text>
                </HStack>
                <VStack align="stretch" spacing={3} pl={9}>
                  <Text fontSize="sm" color="text.muted">
                    サイドバーの「OAuth & Permissions」を開き、以下を設定:
                  </Text>
                  <Box bg="bg.canvas" p={4} borderRadius="lg">
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>
                      Redirect URLs:
                    </Text>
                    <Flex gap={2}>
                      <Input
                        value={redirectUri}
                        isReadOnly
                        bg="bg.surface"
                        borderColor="border.muted"
                        fontFamily="mono"
                        fontSize={{ base: 'xs', md: 'sm' }}
                        flex={1}
                        minW="0"
                      />
                      <Tooltip label={hasCopied ? 'コピーしました' : 'コピー'}>
                        <IconButton
                          aria-label="Copy URL"
                          icon={hasCopied ? <FiCheck /> : <FiCopy />}
                          onClick={onCopy}
                          colorScheme={hasCopied ? 'green' : 'gray'}
                          flexShrink={0}
                        />
                      </Tooltip>
                    </Flex>
                  </Box>
                  <Box bg="bg.canvas" p={4} borderRadius="lg">
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>
                      Bot Token Scopes:
                    </Text>
                    <HStack spacing={2} flexWrap="wrap">
                      <Badge colorScheme="green">chat:write</Badge>
                      <Badge colorScheme="green">users:read</Badge>
                    </HStack>
                  </Box>
                </VStack>
              </Box>

              <Divider borderColor="border.muted" />

              {/* Step 3 */}
              <Box>
                <HStack mb={3}>
                  <Box
                    w={6}
                    h={6}
                    borderRadius="full"
                    bg="brand.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="sm" fontWeight="bold" color="white">
                      3
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">認証情報を入力</Text>
                </HStack>
                <VStack spacing={4} pl={9}>
                  <FormControl>
                    <FormLabel fontSize="sm">Client ID</FormLabel>
                    <Flex gap={2} flexWrap="wrap">
                      <Input
                        value={isClientIdConfigured && !clientId ? '●●●●●●●●●●●●●●●●●●●●' : clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="Basic Information → Client ID"
                        bg="bg.canvas"
                        borderColor="border.muted"
                        isReadOnly={isClientIdConfigured && !clientId}
                        flex={1}
                        minW="0"
                      />
                      {clientId && (
                        <Tooltip label="保存">
                          <IconButton
                            aria-label="Save Client ID"
                            icon={isSaving ? <Spinner size="sm" /> : <FiSave />}
                            onClick={saveClientId}
                            colorScheme="green"
                            isLoading={isSaving}
                          />
                        </Tooltip>
                      )}
                      {isClientIdConfigured && !clientId && (
                        <Button onClick={() => setIsClientIdConfigured(false)} colorScheme="brand" minW="100px" flexShrink={0}>
                          再設定
                        </Button>
                      )}
                    </Flex>
                    <FormHelperText color="text.muted">
                      {isClientIdConfigured && !clientId
                        ? 'Client IDは設定済みです。変更する場合は再設定ボタンをクリックしてください'
                        : 'Slack App の Basic Information から取得して保存してください'}
                    </FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Client Secret</FormLabel>
                    <Flex gap={2} flexWrap="wrap">
                      <Input
                        type="password"
                        value={isClientSecretConfigured && !clientSecret ? '●●●●●●●●●●●●●●●●●●●●' : clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="Basic Information → Client Secret"
                        bg="bg.canvas"
                        borderColor="border.muted"
                        isReadOnly={isClientSecretConfigured && !clientSecret}
                        flex={1}
                        minW="0"
                      />
                      {clientSecret && (
                        <Tooltip label="保存">
                          <IconButton
                            aria-label="Save Client Secret"
                            icon={isSaving ? <Spinner size="sm" /> : <FiSave />}
                            onClick={saveClientSecret}
                            colorScheme="green"
                            isLoading={isSaving}
                          />
                        </Tooltip>
                      )}
                      {isClientSecretConfigured && !clientSecret && (
                        <Button onClick={() => setIsClientSecretConfigured(false)} colorScheme="brand" minW="100px" flexShrink={0}>
                          再設定
                        </Button>
                      )}
                    </Flex>
                    <FormHelperText color="text.muted">
                      {isClientSecretConfigured && !clientSecret
                        ? 'Client Secretは設定済みです。変更する場合は再設定ボタンをクリックしてください'
                        : 'Slack App の Basic Information から取得して保存してください'}
                    </FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">送信先ID（User/Channel）</FormLabel>
                    <Flex gap={2} flexWrap="wrap">
                      <Input
                        value={isChannelIdConfigured && !targetChannelId ? '●●●●●●●●●●●●●●●●●●●●' : targetChannelId}
                        onChange={(e) => setTargetChannelId(e.target.value)}
                        placeholder="例: U1234567890（DM）または C1234567890（チャンネル）"
                        bg="bg.canvas"
                        borderColor="border.muted"
                        isReadOnly={isChannelIdConfigured && !targetChannelId}
                        flex={1}
                        minW="0"
                      />
                      {targetChannelId && (
                        <Tooltip label="保存">
                          <IconButton
                            aria-label="Save Target Channel ID"
                            icon={isSaving ? <Spinner size="sm" /> : <FiSave />}
                            onClick={saveTargetChannelId}
                            colorScheme="green"
                            isLoading={isSaving}
                          />
                        </Tooltip>
                      )}
                      {isChannelIdConfigured && !targetChannelId && (
                        <Button onClick={() => setIsChannelIdConfigured(false)} colorScheme="brand" minW="100px" flexShrink={0}>
                          再設定
                        </Button>
                      )}
                    </Flex>
                    <FormHelperText color="text.muted">
                      {isChannelIdConfigured && !targetChannelId
                        ? '送信先IDは設定済みです（OAuth時に自動設定）。変更する場合は再設定ボタンをクリックしてください'
                        : 'OAuth接続時に自動設定されます（DM）。チャンネルに投稿する場合は、チャンネルを右クリック→「リンクをコピー」から末尾のChannel IDを取得してください'}
                    </FormHelperText>
                  </FormControl>
                </VStack>
              </Box>

              <Divider borderColor="border.muted" />

              {/* Connect Button */}
              <Box>
                <HStack mb={3}>
                  <Box
                    w={6}
                    h={6}
                    borderRadius="full"
                    bg="brand.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="sm" fontWeight="bold" color="white">
                      4
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">ワークスペースに接続</Text>
                </HStack>
                <Box pl={9}>
                  <Button
                    colorScheme="green"
                    size="lg"
                    leftIcon={<FiMessageSquare />}
                    onClick={handleOAuthConnect}
                    isDisabled={!isClientIdConfigured || !isClientSecretConfigured}
                  >
                    Slackワークスペースに接続
                  </Button>
                  {(!isClientIdConfigured || !isClientSecretConfigured) && (
                    <Text fontSize="sm" color="text.muted" mt={2}>
                      Client IDとClient Secretを保存すると接続できます
                    </Text>
                  )}
                </Box>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        {/* External Link */}
        <Button
          as="a"
          href="https://api.slack.com/apps"
          target="_blank"
          rightIcon={<FiExternalLink />}
          variant="outline"
          colorScheme="gray"
        >
          Slack API設定を開く
        </Button>
      </VStack>
      </Box>
    </MainLayout>
  );
}
