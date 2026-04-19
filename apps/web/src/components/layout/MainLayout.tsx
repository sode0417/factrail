'use client';

import { Box, Flex } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  return (
    <Box minH="100vh" bg="bg.canvas">
      <Header title={title} />
      <Sidebar />
      <Box
        as="main"
        minH="100vh"
        pt="var(--topbar-h)"
        pl={{ base: 0, md: 'var(--sidebar-w)' }}
      >
        {children}
      </Box>
    </Box>
  );
}
