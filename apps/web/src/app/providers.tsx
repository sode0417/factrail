'use client';

import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { AuthGuard } from '@/components/auth/AuthGuard';

const lightColorModeManager = {
  type: 'cookie' as const,
  ssr: false,
  get: () => 'light' as const,
  set: () => undefined,
};

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  fonts: {
    heading: 'var(--font-serif-jp), "Noto Serif JP", serif',
    body: 'var(--font-sans-jp), "Noto Sans JP", system-ui, sans-serif',
    mono: '"SF Mono", "JetBrains Mono", monospace',
  },
  colors: {
    brand: {
      50: '#E8F1EA',
      100: '#D4E5D8',
      200: '#B5D2BB',
      300: '#8FB499',
      400: '#6A9678',
      500: '#4A7C59',
      600: '#3C6549',
      700: '#2F5C3E',
      800: '#1F4A30',
      900: '#123320',
    },
    natural: {
      50: '#FBF5E3',
      100: '#F4EEDA',
      200: '#EFE9D5',
      300: '#E4DFD1',
      400: '#C7C1B0',
      500: '#9B9484',
      600: '#7A7366',
      700: '#554F45',
      800: '#2A2A2A',
      900: '#1A1A1A',
    },
    accent: {
      50: '#E8F1EA',
      100: '#D4E5D8',
      200: '#B5D2BB',
      300: '#8FB499',
      400: '#6A9678',
      500: '#4A7C59',
      600: '#3C6549',
      700: '#2F5C3E',
      800: '#1F4A30',
      900: '#123320',
    },
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: 'natural.50' },
      'bg.surface': { default: 'natural.100' },
      'bg.surface-2': { default: 'natural.200' },
      'border.muted': { default: 'natural.300' },
      'text.default': { default: 'natural.800' },
      'text.muted': { default: 'natural.600' },
      'accent.soft': { default: 'brand.50' },
      'accent.default': { default: 'brand.500' },
      'accent.strong': { default: 'brand.700' },
    },
  },
  radii: {
    sm: '10px',
    md: '14px',
    lg: '14px',
    pill: '999px',
  },
  styles: {
    global: {
      body: {
        bg: 'bg.canvas',
        color: 'text.default',
        fontFamily: 'body',
      },
      'h1, h2, h3, h4, h5, h6': {
        fontFamily: 'heading',
        fontWeight: 700,
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: { bg: 'brand.600' },
          _active: { bg: 'brand.700' },
        },
        ghost: {
          color: 'text.default',
          _hover: { bg: 'accent.soft' },
        },
        outline: {
          borderColor: 'border.muted',
          color: 'text.default',
          _hover: { bg: 'accent.soft', borderColor: 'accent.default' },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'bg.surface',
          borderColor: 'border.muted',
          borderWidth: '1px',
          borderRadius: 'md',
        },
      },
    },
    Input: {
      defaultProps: {
        variant: 'filled',
      },
      variants: {
        filled: {
          field: {
            bg: 'bg.surface',
            borderColor: 'border.muted',
            _hover: { bg: 'bg.surface-2' },
            _focus: {
              bg: 'bg.canvas',
              borderColor: 'accent.default',
            },
          },
        },
      },
    },
    Textarea: {
      defaultProps: {
        variant: 'filled',
      },
      variants: {
        filled: {
          bg: 'bg.surface',
          borderColor: 'border.muted',
          _hover: { bg: 'bg.surface-2' },
          _focus: { bg: 'bg.canvas', borderColor: 'accent.default' },
        },
      },
    },
    Select: {
      defaultProps: {
        variant: 'filled',
      },
      variants: {
        filled: {
          field: {
            bg: 'bg.surface',
            borderColor: 'border.muted',
            _hover: { bg: 'bg.surface-2' },
            _focus: { bg: 'bg.canvas', borderColor: 'accent.default' },
          },
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'sm',
        textTransform: 'none',
        fontWeight: 500,
      },
    },
    Menu: {
      baseStyle: {
        list: {
          bg: 'bg.surface',
          borderColor: 'border.muted',
        },
        item: {
          bg: 'transparent',
          _hover: { bg: 'accent.soft' },
          _focus: { bg: 'accent.soft' },
        },
      },
    },
    Drawer: {
      baseStyle: {
        dialog: {
          bg: 'bg.surface',
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: 'bg.surface',
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider theme={theme} colorModeManager={lightColorModeManager}>
      <AuthGuard>{children}</AuthGuard>
    </ChakraProvider>
  );
}
