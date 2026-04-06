'use client';

import { Box, Flex, useDisclosure } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Flex h="100vh" overflow="hidden">
      <Sidebar isOpen={isOpen} onClose={onClose} />
      <Flex
        direction="column"
        ml={{ base: 0, lg: '260px' }}
        flex={1}
        bg="gray.950"
        h="100vh"
        overflow="hidden"
      >
        <Header title={title} subtitle={subtitle} onMenuOpen={onOpen} />
        <Box as="main" flex={1} overflow="hidden" p={{ base: 2, md: 6, lg: 8 }}>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
