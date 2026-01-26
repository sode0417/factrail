'use client';

import {
  Box,
  Card,
  CardBody,
  CardHeader,
  VStack,
  HStack,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app';

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
  const [isClientIdConfigured, setIsClientIdConfigured] = useState(false);
  const [isClientSecretConfigured, setIsClientSecretConfigured] = useState(false);
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
      const response = await fetch(`${API_URL}/settings?provider=slack`);
      if (response.ok) {
        const data: SettingResponse[] = await response.json();
        const clientIdSetting = data.find(s => s.settingType === 'client_id');
        const clientSecretSetting = data.find(s => s.settingType === 'client_secret');
        setIsClientIdConfigured(!!clientIdSetting?.hasValue);
        setIsClientSecretConfigured(!!clientSecretSetting?.hasValue);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, []);

  // 連携状態を取得
  const fetchIntegrations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/integrations?provider=slack`);
      if (response.ok) {
        const data: IntegrationResponse[] = await response.json();
        if (data.length > 0 && data[0].status === 'active') {
          setIsConnected(true);
          setConnectedAccountName(data[0].accountName || 'Unknown Workspace');
        } else {
          setIsConnected(false);
          setConnectedAccountName('');
        }
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
      const response = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'slack',
          settingType: 'client_id',
          value: clientId,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Client IDを保存しました',
          status: 'success',
          duration: 3000,
        });
        setIsClientIdConfigured(true);
        setClientId('');
      } else {
        throw new Error('Failed to save');
      }
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
      const response = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'slack',
          settingType: 'client_secret',
          value: clientSecret,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Client Secretを保存しました',
          status: 'success',
          duration: 3000,
        });
        setIsClientSecretConfigured(true);
        setClientSecret('');
      } else {
        throw new Error('Failed to save');
      }
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

    const scopes = 'chat:write,users:read';
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${useClientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  };

  return (
    <MainLayout title="Slack連携" subtitle="Slack DMへの自動投稿を設定">
      <VStack spacing={6} align="stretch" maxW="800px">
        {/* Status Card */}
        <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
          <CardBody>
            <HStack justify="space-between">
              <HStack spacing={4}>
                <Box p={3} borderRadius="lg" bg="green.900">
                  <Icon as={FiMessageSquare} boxSize={6} color="green.400" />
                </Box>
                <Box>
                  <Text fontWeight="semibold" fontSize="lg">
                    Slack OAuth
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    {isConnected && connectedAccountName
                      ? `連携中: ${connectedAccountName}`
                      : 'DMへの自動投稿を有効化'}
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
            </HStack>
          </CardBody>
        </Card>

        {/* Setup Instructions */}
        <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
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
                    <Text fontSize="sm" fontWeight="bold">
                      1
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">Slack Appを作成</Text>
                </HStack>
                <VStack align="stretch" spacing={3} pl={9}>
                  <Text fontSize="sm" color="gray.400">
                    1. Slack API → Your Apps → Create New App
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    2. 「From scratch」を選択
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    3. App名を入力してワークスペースを選択
                  </Text>
                </VStack>
              </Box>

              <Divider borderColor="gray.700" />

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
                    <Text fontSize="sm" fontWeight="bold">
                      2
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">OAuth & Permissions を設定</Text>
                </HStack>
                <VStack align="stretch" spacing={3} pl={9}>
                  <Text fontSize="sm" color="gray.400">
                    サイドバーの「OAuth & Permissions」を開き、以下を設定:
                  </Text>
                  <Box bg="gray.900" p={4} borderRadius="lg">
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>
                      Redirect URLs:
                    </Text>
                    <HStack>
                      <Input
                        value={redirectUri}
                        isReadOnly
                        bg="gray.800"
                        borderColor="gray.700"
                        fontFamily="mono"
                        fontSize="sm"
                      />
                      <Tooltip label={hasCopied ? 'コピーしました' : 'コピー'}>
                        <IconButton
                          aria-label="Copy URL"
                          icon={hasCopied ? <FiCheck /> : <FiCopy />}
                          onClick={onCopy}
                          colorScheme={hasCopied ? 'green' : 'gray'}
                        />
                      </Tooltip>
                    </HStack>
                  </Box>
                  <Box bg="gray.900" p={4} borderRadius="lg">
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

              <Divider borderColor="gray.700" />

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
                    <Text fontSize="sm" fontWeight="bold">
                      3
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">認証情報を入力</Text>
                </HStack>
                <VStack spacing={4} pl={9}>
                  <FormControl>
                    <FormLabel fontSize="sm">Client ID</FormLabel>
                    <HStack>
                      <Input
                        value={isClientIdConfigured && !clientId ? '●●●●●●●●●●●●●●●●●●●●' : clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="Basic Information → Client ID"
                        bg="gray.900"
                        borderColor="gray.700"
                        isReadOnly={isClientIdConfigured && !clientId}
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
                        <Button onClick={() => setClientId('')} colorScheme="brand" minW="100px">
                          再設定
                        </Button>
                      )}
                    </HStack>
                    <FormHelperText color="gray.500">
                      {isClientIdConfigured && !clientId
                        ? 'Client IDは設定済みです。変更する場合は再設定ボタンをクリックしてください'
                        : 'Slack App の Basic Information から取得して保存してください'}
                    </FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Client Secret</FormLabel>
                    <HStack>
                      <Input
                        type="password"
                        value={isClientSecretConfigured && !clientSecret ? '●●●●●●●●●●●●●●●●●●●●' : clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="Basic Information → Client Secret"
                        bg="gray.900"
                        borderColor="gray.700"
                        isReadOnly={isClientSecretConfigured && !clientSecret}
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
                        <Button onClick={() => setClientSecret('')} colorScheme="brand" minW="100px">
                          再設定
                        </Button>
                      )}
                    </HStack>
                    <FormHelperText color="gray.500">
                      {isClientSecretConfigured && !clientSecret
                        ? 'Client Secretは設定済みです。変更する場合は再設定ボタンをクリックしてください'
                        : 'Slack App の Basic Information から取得して保存してください'}
                    </FormHelperText>
                  </FormControl>
                </VStack>
              </Box>

              <Divider borderColor="gray.700" />

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
                    <Text fontSize="sm" fontWeight="bold">
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
                    <Text fontSize="sm" color="gray.500" mt={2}>
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
    </MainLayout>
  );
}
