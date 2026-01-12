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
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiGithub, FiCopy, FiCheck, FiExternalLink } from 'react-icons/fi';
import { useState } from 'react';

export default function GitHubSetupPage() {
  const [webhookSecret, setWebhookSecret] = useState('');
  const webhookUrl = typeof window !== 'undefined' 
    ? `${process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app'}/webhooks/github`
    : '';
  
  const { hasCopied: hasCopiedUrl, onCopy: onCopyUrl } = useClipboard(webhookUrl);
  const { hasCopied: hasCopiedSecret, onCopy: onCopySecret } = useClipboard(webhookSecret);

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setWebhookSecret(secret);
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
              <Badge colorScheme="yellow" fontSize="sm" px={3} py={1}>
                未設定
              </Badge>
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
                  <Text fontWeight="semibold">Webhook Secretを生成</Text>
                </HStack>
                <FormControl>
                  <HStack mb={2}>
                    <Input
                      value={webhookSecret}
                      isReadOnly
                      placeholder="シークレットを生成してください"
                      bg="gray.900"
                      borderColor="gray.700"
                      fontFamily="mono"
                      fontSize="sm"
                    />
                    <Button onClick={generateSecret} colorScheme="brand" minW="100px">
                      生成
                    </Button>
                    {webhookSecret && (
                      <Tooltip label={hasCopiedSecret ? 'コピーしました' : 'コピー'}>
                        <IconButton
                          aria-label="Copy Secret"
                          icon={hasCopiedSecret ? <FiCheck /> : <FiCopy />}
                          onClick={onCopySecret}
                          colorScheme={hasCopiedSecret ? 'green' : 'gray'}
                        />
                      </Tooltip>
                    )}
                  </HStack>
                  <FormHelperText color="gray.500">
                    このシークレットはサーバーの環境変数にも設定してください
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

              <Divider borderColor="gray.700" />

              {/* Step 4 */}
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
                  <Text fontWeight="semibold">環境変数を設定</Text>
                </HStack>
                <Alert status="info" bg="blue.900" borderRadius="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">Railway環境変数</AlertTitle>
                    <AlertDescription fontSize="sm">
                      <Code colorScheme="blue">GITHUB_WEBHOOK_SECRET</Code> に生成したシークレットを設定
                    </AlertDescription>
                  </Box>
                </Alert>
              </Box>
            </VStack>
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
    </MainLayout>
  );
}
