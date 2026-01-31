'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Heading,
  Text,
  Card,
  CardBody,
  Icon,
  Flex,
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { FaGoogle, FaGithub } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { login, isAuthenticated, _hasHydrated } = useAuthStore();

  const [isLogin, setIsLogin] = useState(true); // true: ログイン, false: 登録
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app';

  // 既に認証済みの場合はダッシュボードへリダイレクト
  if (_hasHydrated && isAuthenticated) {
    router.push('/');
    return null;
  }

  const handleGoogleLogin = () => {
    window.location.href = `${apiUrl}/auth/google`;
  };

  const handleGithubLogin = () => {
    window.location.href = `${apiUrl}/auth/github`;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isLogin) {
        // ログイン
        const response = await apiClient.post('/auth/login', {
          email,
          password,
        });

        login(response.data);
        toast({
          title: 'ログインしました',
          status: 'success',
          duration: 3000,
        });
        router.push('/');
      } else {
        // 新規登録
        await apiClient.post('/auth/register', {
          email,
          password,
          name,
        });

        toast({
          title: 'アカウントを作成しました',
          description: 'ログインしてください',
          status: 'success',
          duration: 5000,
        });

        setIsLogin(true);
        setPassword('');
      }
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message || 'エラーが発生しました';

      if (Array.isArray(errorMessage)) {
        const fieldErrors: { email?: string; password?: string } = {};
        errorMessage.forEach((msg: string) => {
          if (msg.includes('email')) fieldErrors.email = msg;
          if (msg.includes('password')) fieldErrors.password = msg;
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: 'エラー',
          description: errorMessage,
          status: 'error',
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.900">
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px" maxW="md" w="full">
        <CardBody>
          <VStack spacing={6} align="stretch">
            <Box textAlign="center">
              <Heading size="lg" mb={2}>
                {isLogin ? 'Factrailにログイン' : '新規アカウント作成'}
              </Heading>
              <Text color="gray.400" fontSize="sm">
                {isLogin
                  ? 'メールアドレスまたはOAuthでログイン'
                  : 'メールアドレスで新規登録'}
              </Text>
            </Box>

            {/* OAuth認証 */}
            <VStack spacing={3}>
              <Button
                w="full"
                colorScheme="red"
                leftIcon={<Icon as={FaGoogle} />}
                onClick={handleGoogleLogin}
                size="lg"
              >
                Googleでログイン
              </Button>

              <Button
                w="full"
                colorScheme="gray"
                leftIcon={<Icon as={FaGithub} />}
                onClick={handleGithubLogin}
                size="lg"
              >
                GitHubでログイン
              </Button>
            </VStack>

            <Divider />

            {/* メール/パスワード認証 */}
            <form onSubmit={handleEmailAuth}>
              <VStack spacing={4}>
                {!isLogin && (
                  <FormControl>
                    <FormLabel>名前（任意）</FormLabel>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="山田太郎"
                    />
                  </FormControl>
                )}

                <FormControl isInvalid={!!errors.email}>
                  <FormLabel>メールアドレス</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@example.com"
                    required
                  />
                  <FormErrorMessage>{errors.email}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.password}>
                  <FormLabel>パスワード</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      isLogin
                        ? 'パスワード'
                        : '大文字、小文字、数字を含む8文字以上'
                    }
                    required
                  />
                  <FormErrorMessage>{errors.password}</FormErrorMessage>
                </FormControl>

                <Button
                  type="submit"
                  w="full"
                  colorScheme="blue"
                  isLoading={isLoading}
                  size="lg"
                >
                  {isLogin ? 'ログイン' : '登録する'}
                </Button>
              </VStack>
            </form>

            {/* 切り替えリンク */}
            <Text textAlign="center" fontSize="sm">
              {isLogin ? (
                <>
                  アカウントをお持ちでない方は{' '}
                  <Button
                    variant="link"
                    colorScheme="blue"
                    onClick={() => setIsLogin(false)}
                  >
                    新規登録
                  </Button>
                </>
              ) : (
                <>
                  既にアカウントをお持ちの方は{' '}
                  <Button
                    variant="link"
                    colorScheme="blue"
                    onClick={() => setIsLogin(true)}
                  >
                    ログイン
                  </Button>
                </>
              )}
            </Text>

            <Text fontSize="xs" color="gray.500" textAlign="center">
              ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます
            </Text>
          </VStack>
        </CardBody>
      </Card>
    </Flex>
  );
}
