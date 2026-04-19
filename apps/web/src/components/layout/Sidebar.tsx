'use client';

import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiDatabase,
  FiGithub,
  FiMessageSquare,
  FiSettings,
} from 'react-icons/fi';
import { IconType } from 'react-icons';

interface NavItem {
  name: string;
  href: string;
  icon: IconType;
}

const mainNavItems: NavItem[] = [
  { name: 'Facts', href: '/facts', icon: FiDatabase },
];

const setupNavItems: NavItem[] = [
  { name: 'GitHub', href: '/setup/github', icon: FiGithub },
  { name: 'Slack', href: '/setup/slack', icon: FiMessageSquare },
];

const settingsNavItems: NavItem[] = [
  { name: '一般', href: '/settings', icon: FiSettings },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link href={item.href} style={{ width: '100%' }}>
      <Flex
        align="center"
        gap={3}
        px={3}
        py="9px"
        borderRadius="sm"
        cursor="pointer"
        bg={isActive ? 'accent.default' : 'transparent'}
        color={isActive ? 'white' : 'text.default'}
        _hover={{
          bg: isActive ? 'accent.strong' : 'accent.soft',
        }}
        transition="background 0.15s ease"
        fontWeight={500}
        whiteSpace="nowrap"
        fontSize="sm"
      >
        <Icon as={item.icon} boxSize="18px" flexShrink={0} />
        <Text
          className="nav-label"
          opacity={0}
          transition="opacity 0.18s ease 0.05s"
        >
          {item.name}
        </Text>
      </Flex>
    </Link>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <Text
      className="nav-section"
      color="text.muted"
      fontSize="11px"
      textTransform="uppercase"
      letterSpacing="0.08em"
      px={3}
      pt="10px"
      pb="4px"
      whiteSpace="nowrap"
      opacity={0}
      transition="opacity 0.18s ease 0.05s"
    >
      {label}
    </Text>
  );
}

export function Sidebar() {
  return (
    <Box
      as="aside"
      bg="bg.surface"
      borderRight="1px solid"
      borderColor="border.muted"
      w="var(--sidebar-w)"
      position="fixed"
      left={0}
      top="var(--topbar-h)"
      h="calc(100vh - var(--topbar-h))"
      zIndex={20}
      overflow="hidden"
      px="10px"
      py="18px"
      display={{ base: 'none', md: 'flex' }}
      flexDirection="column"
      gap="14px"
      transition="width 0.22s ease, box-shadow 0.22s ease, padding 0.22s ease"
      _hover={{
        w: 'var(--sidebar-w-expanded)',
        overflow: 'visible',
        px: '14px',
        boxShadow: '8px 0 28px rgba(74,60,20,0.08)',
        '& .nav-label': { opacity: 1 },
        '& .nav-section': { opacity: 1 },
      }}
    >
      <Flex direction="column" gap="2px" minW="220px">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <NavSection label="連携" />
        {setupNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <NavSection label="設定" />
        {settingsNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </Flex>
    </Box>
  );
}
