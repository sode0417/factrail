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
    <Flex minH="100vh">
      <Sidebar isOpen={isOpen} onClose={onClose} />
      <Box ml={{ base: 0, lg: '260px' }} flex={1} bg="gray.950">
        <Header title={title} subtitle={subtitle} onMenuOpen={onOpen} />
        <Box as="main" p={{ base: 4, md: 6, lg: 8 }}>
          {children}
        </Box>
      </Box>
    </Flex>
  );
}
