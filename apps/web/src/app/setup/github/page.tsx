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
  FormHelperText,
  Code,
  Divider,
  Badge,
  Icon,
  useClipboard,
  IconButton,
  Tooltip,
  useToast,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiGithub, FiCopy, FiCheck, FiExternalLink, FiSave, FiTrash2, FiPlus, FiSearch, FiZap } from 'react-icons/fi';
import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app';

interface SettingResponse {
  id: string;
  provider: string;
  settingType: string;
  hasValue: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Repository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
  status: string;
  lastEventAt: string | null;
  createdAt: string;
}

interface GitHubRepoInfo {
  fullName: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  htmlUrl: string;
}

export default function GitHubSetupPage() {
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewSecret, setIsNewSecret] = useState(false);
  const toast = useToast();

  // Repository state
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoInfo[]>([]);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [addingRepo, setAddingRepo] = useState<string | null>(null);
  const [removingRepo, setRemovingRepo] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const webhookUrl = typeof window !== 'undefined'
    ? `${API_URL}/webhooks/github`
    : '';

  const { hasCopied: hasCopiedUrl, onCopy: onCopyUrl } = useClipboard(webhookUrl);
  const { hasCopied: hasCopiedSecret, onCopy: onCopySecret } = useClipboard(webhookSecret);

  // 設定状態を取得
  const fetchSettings = useCallback(async () => {
    try {
      const response = await apiClient.get<SettingResponse[]>('/settings', {
        params: { provider: 'github' },
      });
      const webhookSetting = response.data.find(s => s.settingType === 'webhook_secret');
      setIsConfigured(!!webhookSetting?.hasValue);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 登録済みリポジトリを取得
  const fetchRepositories = useCallback(async () => {
    try {
      const response = await apiClient.get<Repository[]>('/repositories');
      setRepositories(response.data);
    } catch (_error) {
      // GitHub連携がない場合は空配列
      setRepositories([]);
    } finally {
      setIsLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchRepositories();
  }, [fetchSettings, fetchRepositories]);

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setWebhookSecret(secret);
    setIsNewSecret(true);
  };

  const saveSecret = async () => {
    if (!webhookSecret) {
      toast({
        title: 'シークレットを生成してください',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/settings', {
        provider: 'github',
        settingType: 'webhook_secret',
        value: webhookSecret,
      });

      toast({
        title: 'Webhook Secretを保存しました',
        description: 'GitHubのWebhook設定にも同じシークレットを設定してください',
        status: 'success',
        duration: 5000,
      });
      setIsConfigured(true);
      setIsNewSecret(false);
    } catch (error) {
      console.error('Failed to save secret:', error);
      toast({
        title: '保存に失敗しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // リポジトリ追加モーダルを開く
  const openAddModal = async () => {
    onOpen();
    setIsLoadingAvailable(true);
    setSearchFilter('');
    try {
      const response = await apiClient.get<GitHubRepoInfo[]>('/repositories/github/available');
      setAvailableRepos(response.data);
    } catch (error) {
      console.error('Failed to fetch available repos:', error);
      toast({
        title: 'リポジトリ一覧の取得に失敗しました',
        description: 'GitHub連携を確認してください',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoadingAvailable(false);
    }
  };

  // リポジトリを追加
  const addRepository = async (fullName: string) => {
    setAddingRepo(fullName);
    try {
      await apiClient.post('/repositories', { fullName });
      toast({
        title: 'リポジトリを追加しました',
        description: fullName,
        status: 'success',
        duration: 3000,
      });
      await fetchRepositories();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast({
        title: '追加に失敗しました',
        description: axiosError.response?.data?.message || 'エラーが発生しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setAddingRepo(null);
    }
  };

  // リポジトリを削除
  const removeRepository = async (id: string) => {
    setRemovingRepo(id);
    try {
      await apiClient.delete(`/repositories/${id}`);
      toast({
        title: 'リポジトリを削除しました',
        status: 'success',
        duration: 3000,
      });
      await fetchRepositories();
    } catch (error) {
      console.error('Failed to remove repository:', error);
      toast({
        title: '削除に失敗しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setRemovingRepo(null);
    }
  };

  // 既存Factsから自動検出
  const detectRepositories = async () => {
    setIsDetecting(true);
    try {
      const response = await apiClient.post<{ added: string[] }>('/repositories/detect');
      const { added } = response.data;
      if (added.length > 0) {
        toast({
          title: `${added.length}件のリポジトリを検出しました`,
          description: added.join(', '),
          status: 'success',
          duration: 5000,
        });
        await fetchRepositories();
      } else {
        toast({
          title: '新しいリポジトリは見つかりませんでした',
          status: 'info',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to detect repositories:', error);
      toast({
        title: '自動検出に失敗しました',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // 利用可能リポジトリをフィルタ（登録済みを除外 + 検索フィルタ）
  const registeredNames = new Set(repositories.map(r => r.fullName));
  const filteredAvailableRepos = availableRepos.filter(repo => {
    if (registeredNames.has(repo.fullName)) return false;
    if (searchFilter && !repo.fullName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <MainLayout title="GitHub連携" subtitle="GitHubリポジトリからのWebhookを設定">
      <VStack spacing={6} align="stretch" maxW="800px">
        {/* Status Card */}
        <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
          <CardBody>
            <HStack justify="space-between">
              <HStack spacing={4}>
                <Box p={3} borderRadius="lg" bg="purple.900">
                  <Icon as={FiGithub} boxSize={6} color="purple.400" />
                </Box>
                <Box>
                  <Text fontWeight="semibold" fontSize="lg">
                    GitHub Webhook
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    Issue/PR/Commit イベントを受信
                  </Text>
                </Box>
              </HStack>
              {isLoading ? (
                <Spinner size="sm" />
              ) : (
                <Badge
                  colorScheme={isConfigured ? 'green' : 'yellow'}
                  fontSize="sm"
                  px={3}
                  py={1}
                >
                  {isConfigured ? '設定済み' : '未設定'}
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
                  <Text fontWeight="semibold">Webhook URLをコピー</Text>
                </HStack>
                <FormControl>
                  <HStack>
                    <Input
                      value={webhookUrl}
                      isReadOnly
                      bg="gray.900"
                      borderColor="gray.700"
                      fontFamily="mono"
                      fontSize="sm"
                    />
                    <Tooltip label={hasCopiedUrl ? 'コピーしました' : 'コピー'}>
                      <IconButton
                        aria-label="Copy URL"
                        icon={hasCopiedUrl ? <FiCheck /> : <FiCopy />}
                        onClick={onCopyUrl}
                        colorScheme={hasCopiedUrl ? 'green' : 'gray'}
                      />
                    </Tooltip>
                  </HStack>
                </FormControl>
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
                  <Text fontWeight="semibold">Webhook Secretを生成・保存</Text>
                </HStack>
                <FormControl>
                  <HStack mb={2}>
                    <Input
                      value={isConfigured && !isNewSecret ? '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●' : webhookSecret}
                      isReadOnly
                      placeholder="シークレットを生成してください"
                      bg="gray.900"
                      borderColor="gray.700"
                      fontFamily="mono"
                      fontSize="sm"
                    />
                    <Button onClick={generateSecret} colorScheme="brand" minW="100px">
                      {isConfigured ? '再生成' : '生成'}
                    </Button>
                    {webhookSecret && isNewSecret && (
                      <>
                        <Tooltip label={hasCopiedSecret ? 'コピーしました' : 'コピー'}>
                          <IconButton
                            aria-label="Copy Secret"
                            icon={hasCopiedSecret ? <FiCheck /> : <FiCopy />}
                            onClick={onCopySecret}
                            colorScheme={hasCopiedSecret ? 'green' : 'gray'}
                          />
                        </Tooltip>
                        <Tooltip label="サーバーに保存">
                          <IconButton
                            aria-label="Save Secret"
                            icon={isSaving ? <Spinner size="sm" /> : <FiSave />}
                            onClick={saveSecret}
                            colorScheme="green"
                            isLoading={isSaving}
                          />
                        </Tooltip>
                      </>
                    )}
                  </HStack>
                  <FormHelperText color="gray.500">
                    {isNewSecret
                      ? '生成したシークレットをコピーしてからサーバーに保存してください'
                      : isConfigured
                        ? 'シークレットは既に設定されています。変更する場合は再生成してください'
                        : 'シークレットを生成してサーバーに保存してください'
                    }
                  </FormHelperText>
                </FormControl>
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
                  <Text fontWeight="semibold">GitHubでWebhookを設定</Text>
                </HStack>
                <VStack align="stretch" spacing={3} pl={9}>
                  <Text fontSize="sm" color="gray.400">
                    1. GitHubリポジトリの Settings → Webhooks へ移動
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    2. 「Add webhook」をクリック
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    3. 以下の設定を入力:
                  </Text>
                  <Box bg="gray.900" p={4} borderRadius="lg" fontSize="sm">
                    <VStack align="stretch" spacing={2}>
                      <HStack>
                        <Text color="gray.500" minW="120px">
                          Payload URL:
                        </Text>
                        <Code colorScheme="brand">{webhookUrl}</Code>
                      </HStack>
                      <HStack>
                        <Text color="gray.500" minW="120px">
                          Content type:
                        </Text>
                        <Code colorScheme="gray">application/json</Code>
                      </HStack>
                      <HStack>
                        <Text color="gray.500" minW="120px">
                          Secret:
                        </Text>
                        <Code colorScheme="orange">
                          {webhookSecret || '(上で生成したシークレット)'}
                        </Code>
                      </HStack>
                    </VStack>
                  </Box>
                  <Text fontSize="sm" color="gray.400">
                    4. イベントで「Let me select individual events」を選択
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    5. Issues, Pull requests, Pushes にチェック
                  </Text>
                </VStack>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        {/* Repository Management Card */}
        <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
          <CardHeader>
            <HStack justify="space-between">
              <Text fontSize="lg" fontWeight="semibold">
                リポジトリ管理
              </Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  leftIcon={<FiZap />}
                  variant="outline"
                  colorScheme="yellow"
                  onClick={detectRepositories}
                  isLoading={isDetecting}
                  loadingText="検出中"
                >
                  自動検出
                </Button>
                <Button
                  size="sm"
                  leftIcon={<FiPlus />}
                  colorScheme="brand"
                  onClick={openAddModal}
                >
                  追加
                </Button>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            {isLoadingRepos ? (
              <HStack justify="center" py={4}>
                <Spinner size="sm" />
                <Text color="gray.400">読み込み中...</Text>
              </HStack>
            ) : repositories.length === 0 ? (
              <Box bg="gray.900" p={4} borderRadius="lg">
                <Text color="gray.400" fontSize="sm">
                  リポジトリが登録されていません。リポジトリを追加すると、登録済みリポジトリからのイベントのみがFactとして記録されます。
                </Text>
                <Text color="gray.500" fontSize="xs" mt={2}>
                  リポジトリ未登録の場合、すべてのリポジトリからのイベントが記録されます。
                </Text>
              </Box>
            ) : (
              <VStack spacing={3} align="stretch">
                {repositories.map((repo) => (
                  <HStack
                    key={repo.id}
                    bg="gray.900"
                    p={3}
                    borderRadius="lg"
                    justify="space-between"
                  >
                    <HStack spacing={3}>
                      <Icon as={FiGithub} color="gray.400" />
                      <Box>
                        <HStack spacing={2}>
                          <Text fontSize="sm" fontWeight="medium">
                            {repo.fullName}
                          </Text>
                          <Badge
                            colorScheme={repo.isPrivate ? 'orange' : 'green'}
                            fontSize="xs"
                          >
                            {repo.isPrivate ? 'Private' : 'Public'}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          最終イベント: {formatDate(repo.lastEventAt)}
                        </Text>
                      </Box>
                    </HStack>
                    <IconButton
                      aria-label="Remove repository"
                      icon={removingRepo === repo.id ? <Spinner size="xs" /> : <FiTrash2 />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => removeRepository(repo.id)}
                      isLoading={removingRepo === repo.id}
                    />
                  </HStack>
                ))}
              </VStack>
            )}
          </CardBody>
        </Card>

        {/* External Link */}
        <Button
          as="a"
          href="https://github.com/settings/apps"
          target="_blank"
          rightIcon={<FiExternalLink />}
          variant="outline"
          colorScheme="gray"
        >
          GitHub設定を開く
        </Button>
      </VStack>

      {/* Add Repository Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent bg="gray.800" borderColor="gray.700" borderWidth="1px">
          <ModalHeader>リポジトリを追加</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <InputGroup>
                <InputLeftElement>
                  <FiSearch color="gray" />
                </InputLeftElement>
                <Input
                  placeholder="リポジトリ名で検索..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  bg="gray.900"
                  borderColor="gray.700"
                />
              </InputGroup>

              {isLoadingAvailable ? (
                <HStack justify="center" py={8}>
                  <Spinner size="sm" />
                  <Text color="gray.400">GitHub APIから取得中...</Text>
                </HStack>
              ) : filteredAvailableRepos.length === 0 ? (
                <Box py={4}>
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    {searchFilter ? '検索結果がありません' : '追加可能なリポジトリがありません'}
                  </Text>
                </Box>
              ) : (
                <VStack
                  spacing={2}
                  align="stretch"
                  maxH="400px"
                  overflowY="auto"
                  pr={2}
                >
                  {filteredAvailableRepos.map((repo) => (
                    <HStack
                      key={repo.fullName}
                      bg="gray.900"
                      p={3}
                      borderRadius="lg"
                      justify="space-between"
                      _hover={{ bg: 'gray.750' }}
                    >
                      <HStack spacing={3}>
                        <Icon as={FiGithub} color="gray.400" />
                        <Box>
                          <HStack spacing={2}>
                            <Text fontSize="sm" fontWeight="medium">
                              {repo.fullName}
                            </Text>
                            <Badge
                              colorScheme={repo.isPrivate ? 'orange' : 'green'}
                              fontSize="xs"
                            >
                              {repo.isPrivate ? 'Private' : 'Public'}
                            </Badge>
                          </HStack>
                        </Box>
                      </HStack>
                      <Button
                        size="sm"
                        colorScheme="brand"
                        onClick={() => addRepository(repo.fullName)}
                        isLoading={addingRepo === repo.fullName}
                        loadingText="追加中"
                      >
                        追加
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </MainLayout>
  );
}
