'use client';

import { ChakraProvider, extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  fonts: {
    heading: '"JetBrains Mono", monospace',
    body: '"Inter", sans-serif',
  },
  colors: {
    brand: {
      50: '#e3f9ed',
      100: '#c2efd6',
      200: '#9de5bd',
      300: '#74daa3',
      400: '#4ad089',
      500: '#2db67d',
      600: '#238f62',
      700: '#196948',
      800: '#0f432e',
      900: '#051d14',
    },
    accent: {
      50: '#fff3e0',
      100: '#ffe0b2',
      200: '#ffcc80',
      300: '#ffb74d',
      400: '#ffa726',
      500: '#ff9800',
      600: '#fb8c00',
      700: '#f57c00',
      800: '#ef6c00',
      900: '#e65100',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'gray.100',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'gray.800',
          borderColor: 'gray.700',
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}
