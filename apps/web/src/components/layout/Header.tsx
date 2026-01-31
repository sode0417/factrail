'use client';

import { Box, Flex, Text, IconButton, Input, InputGroup, InputLeftElement, Menu, MenuButton, MenuList, MenuItem, Avatar } from '@chakra-ui/react';
import { FiSearch, FiBell, FiLogOut } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/axios';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
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
      h="80px"
      bg="gray.900"
      borderBottom="1px"
      borderColor="gray.800"
      px={8}
    >
      <Flex h="full" align="center" justify="space-between">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" fontFamily="heading">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="sm" color="gray.500" mt={1}>
              {subtitle}
            </Text>
          )}
        </Box>

        <Flex align="center" gap={4}>
          <InputGroup maxW="300px">
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
