'use client';

import {
  Box,
  Flex,
  Text,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
} from '@chakra-ui/react';
import Image from 'next/image';
import { FiSearch, FiBell, FiLogOut } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/axios';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
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
    <Flex
      as="header"
      h="var(--topbar-h)"
      bg="bg.surface"
      borderBottom="1px solid"
      borderColor="border.muted"
      align="center"
      gap={4}
      pl={{ base: 4, md: '19px' }}
      pr={{ base: 4, md: 8 }}
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={30}
      flexShrink={0}
    >
      {/* Brand: logo symbol + wordmark */}
      <Flex align="center" gap={2} pr={2} flexShrink={0}>
        <Image
          src="/logo/symbol.png"
          alt=""
          width={40}
          height={40}
          priority
          style={{ height: 40, width: 'auto', display: 'block' }}
        />
        <Box display={{ base: 'none', md: 'block' }}>
          <Image
            src="/logo/wordmark.png"
            alt="Factrail"
            width={120}
            height={24}
            priority
            style={{ height: 24, width: 'auto', display: 'block' }}
          />
        </Box>
      </Flex>

      {/* Breadcrumb separator + page title */}
      <Text
        as="span"
        color="text.muted"
        fontSize="16px"
        mx={{ base: 1, md: 2 }}
        display={{ base: 'none', sm: 'inline' }}
      >
        /
      </Text>
      <Text
        as="h1"
        fontFamily="heading"
        fontSize={{ base: 'md', md: 'lg' }}
        fontWeight={700}
        color="text.default"
        flexShrink={0}
        display={{ base: 'none', sm: 'block' }}
      >
        {title}
      </Text>

      {/* Search */}
      <InputGroup
        maxW="480px"
        ml="auto"
        display={{ base: 'none', md: 'flex' }}
      >
        <InputLeftElement pointerEvents="none">
          <FiSearch color="#7A7366" />
        </InputLeftElement>
        <Input
          placeholder="検索…"
          bg="bg.canvas"
          borderColor="border.muted"
          borderRadius="pill"
          _hover={{ bg: 'bg.canvas' }}
          _focus={{ bg: 'bg.canvas', borderColor: 'accent.default' }}
          fontSize="13px"
        />
      </InputGroup>

      <IconButton
        aria-label="通知"
        icon={<FiBell />}
        variant="ghost"
        color="text.muted"
        borderRadius="full"
        _hover={{ bg: 'accent.soft', color: 'accent.strong' }}
        size="sm"
        ml={{ base: 'auto', md: 0 }}
      />

      <Menu>
        <MenuButton>
          <Avatar
            size="sm"
            name={user?.name || user?.email}
            src={user?.avatar}
            bg="accent.default"
            color="white"
          />
        </MenuButton>
        <MenuList>
          <MenuItem icon={<FiLogOut />} onClick={handleLogout}>
            ログアウト
          </MenuItem>
        </MenuList>
      </Menu>
    </Flex>
  );
}
