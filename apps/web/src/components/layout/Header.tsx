'use client';

import { Box, Flex, Text, IconButton, Input, InputGroup, InputLeftElement, Menu, MenuButton, MenuList, MenuItem, Avatar } from '@chakra-ui/react';
import { FiSearch, FiBell, FiLogOut, FiMenu } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/axios';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuOpen?: () => void;
}

export function Header({ title, subtitle, onMenuOpen }: HeaderProps) {
  const router = useRouter();
  const { user, sessionId, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout', { sessionId });
    } catch (error) {
      console.error('ログアウトエラー', error);
    } finally {
      logout();
      router.push('/login');
    }
  };

  return (
    <Box
      as="header"
      h={{ base: '64px', lg: '80px' }}
      bg="gray.900"
      borderBottom="1px"
      borderColor="gray.800"
      px={{ base: 4, md: 6, lg: 8 }}
    >
      <Flex h="full" align="center" justify="space-between">
        <Flex align="center" gap={3}>
          {/* ハンバーガーメニュー（モバイルのみ） */}
          <IconButton
            aria-label="メニュー"
            icon={<FiMenu />}
            variant="ghost"
            color="gray.400"
            _hover={{ bg: 'gray.800', color: 'white' }}
            onClick={onMenuOpen}
            display={{ base: 'flex', lg: 'none' }}
            size="sm"
          />
          <Box>
            <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="bold" fontFamily="heading">
              {title}
            </Text>
            {subtitle && (
              <Text fontSize={{ base: 'xs', md: 'sm' }} color="gray.500" mt={1} display={{ base: 'none', md: 'block' }}>
                {subtitle}
              </Text>
            )}
          </Box>
        </Flex>

        <Flex align="center" gap={{ base: 2, md: 4 }}>
          {/* 検索バー（デスクトップのみ） */}
          <InputGroup maxW="300px" display={{ base: 'none', md: 'flex' }}>
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray" />
            </InputLeftElement>
            <Input
              placeholder="検索..."
              bg="gray.800"
              border="none"
              _placeholder={{ color: 'gray.500' }}
              _focus={{ bg: 'gray.700', boxShadow: 'none' }}
            />
          </InputGroup>

          <IconButton
            aria-label="通知"
            icon={<FiBell />}
            variant="ghost"
            color="gray.400"
            _hover={{ bg: 'gray.800', color: 'white' }}
            size={{ base: 'sm', md: 'md' }}
          />

          <Menu>
            <MenuButton>
              <Avatar
                size="sm"
                name={user?.name || user?.email}
                src={user?.avatar}
                bg="brand.500"
              />
            </MenuButton>
            <MenuList bg="gray.800" borderColor="gray.700">
              <MenuItem
                icon={<FiLogOut />}
                onClick={handleLogout}
                bg="gray.800"
                _hover={{ bg: 'gray.700' }}
              >
                ログアウト
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
    </Box>
  );
}
