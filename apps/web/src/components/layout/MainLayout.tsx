'use client';

import { Box, Flex } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  return (
    <Flex minH="100vh">
      <Sidebar />
      <Box ml="260px" flex={1} bg="gray.950">
        <Header title={title} subtitle={subtitle} />
        <Box as="main" p={8}>
          {children}
        </Box>
      </Box>
    </Flex>
  );
}
