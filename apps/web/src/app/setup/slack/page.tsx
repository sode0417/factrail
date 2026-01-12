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
import { FiMessageSquare, FiCopy, FiCheck, FiExternalLink } from 'react-icons/fi';
import { useState } from 'react';

export default function SlackSetupPage() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/setup/slack/callback`
    : '';
  
  const { hasCopied, onCopy } = useClipboard(redirectUri);

  const handleOAuthConnect = () => {
    if (!clientId) {
      alert('Client IDを入力してください');
      return;
    }
    
    const scopes = 'chat:write,users:read';
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.open(authUrl, '_blank');
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
                    DMへの自動投稿を有効化
                  </Text>
                </Box>
              </HStack>
              <Badge colorScheme="yellow" fontSize="sm" px={3} py={1}>
                未接続
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
                    <Input
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Basic Information → Client ID"
                      bg="gray.900"
                      borderColor="gray.700"
                    />
                    <FormHelperText color="gray.500">
                      Slack App の Basic Information から取得
                    </FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Client Secret</FormLabel>
                    <Input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Basic Information → Client Secret"
                      bg="gray.900"
                      borderColor="gray.700"
                    />
                    <FormHelperText color="gray.500">
                      サーバーの環境変数にも設定してください
                    </FormHelperText>
                  </FormControl>
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
                      <VStack align="start" spacing={1} mt={1}>
                        <Code colorScheme="blue">SLACK_CLIENT_ID</Code>
                        <Code colorScheme="blue">SLACK_CLIENT_SECRET</Code>
                        <Code colorScheme="blue">SLACK_REDIRECT_URI</Code>
                      </VStack>
                    </AlertDescription>
                  </Box>
                </Alert>
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
                      5
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
                    isDisabled={!clientId}
                  >
                    Slackワークスペースに接続
                  </Button>
                  {!clientId && (
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      Client IDを入力すると接続できます
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
