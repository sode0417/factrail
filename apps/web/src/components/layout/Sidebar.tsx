'use client';

import {
  Box,
  Flex,
  Icon,
  Text,
  VStack,
  Divider,
  Badge,
} from '@chakra-ui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiHome,
  FiDatabase,
  FiSettings,
  FiGithub,
  FiMessageSquare,
  FiActivity,
} from 'react-icons/fi';
import { IconType } from 'react-icons';

interface NavItem {
  name: string;
  href: string;
  icon: IconType;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { name: 'ダッシュボード', href: '/', icon: FiHome },
  { name: 'Facts', href: '/facts', icon: FiDatabase },
  { name: 'アクティビティ', href: '/activity', icon: FiActivity },
];

const setupNavItems: NavItem[] = [
  { name: 'GitHub', href: '/setup/github', icon: FiGithub },
  { name: 'Slack', href: '/setup/slack', icon: FiMessageSquare },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link href={item.href} style={{ width: '100%' }}>
      <Flex
        align="center"
        px={4}
        py={3}
        borderRadius="lg"
        cursor="pointer"
        bg={isActive ? 'brand.500' : 'transparent'}
        color={isActive ? 'white' : 'gray.400'}
        _hover={{
          bg: isActive ? 'brand.600' : 'gray.800',
          color: 'white',
        }}
        transition="all 0.2s"
      >
        <Icon as={item.icon} boxSize={5} mr={3} />
        <Text fontWeight={isActive ? 'semibold' : 'medium'}>{item.name}</Text>
        {item.badge && (
          <Badge ml="auto" colorScheme="accent" variant="solid" fontSize="xs">
            {item.badge}
          </Badge>
        )}
      </Flex>
    </Link>
  );
}

export function Sidebar() {
  return (
    <Box
      as="aside"
      w="260px"
      h="100vh"
      bg="gray.900"
      borderRight="1px"
      borderColor="gray.800"
      position="fixed"
      left={0}
      top={0}
      py={6}
    >
      {/* Logo */}
      <Flex px={6} mb={8} align="center">
        <Box
          w={10}
          h={10}
          borderRadius="lg"
          bg="brand.500"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mr={3}
        >
          <Text fontSize="xl" fontWeight="bold" color="white">
            F
          </Text>
        </Box>
        <Box>
          <Text
            fontSize="xl"
            fontWeight="bold"
            fontFamily="heading"
            letterSpacing="-0.5px"
          >
            Factrail
          </Text>
          <Text fontSize="xs" color="gray.500">
            Fact Trail
          </Text>
        </Box>
      </Flex>

      {/* Main Navigation */}
      <VStack spacing={1} align="stretch" px={3}>
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </VStack>

      <Divider my={6} borderColor="gray.800" />

      {/* Setup Section */}
      <Box px={6} mb={3}>
        <Flex align="center">
          <Icon as={FiSettings} boxSize={4} color="gray.500" mr={2} />
          <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase">
            連携設定
          </Text>
        </Flex>
      </Box>
      <VStack spacing={1} align="stretch" px={3}>
        {setupNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </VStack>

      {/* Status Footer */}
      <Box position="absolute" bottom={6} left={0} right={0} px={6}>
        <Flex
          p={3}
          bg="gray.800"
          borderRadius="lg"
          align="center"
          justify="space-between"
        >
          <Flex align="center">
            <Box w={2} h={2} borderRadius="full" bg="green.400" mr={2} />
            <Text fontSize="sm" color="gray.400">
              API接続中
            </Text>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
