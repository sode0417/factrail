'use client';

import { Box } from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <Box
      fontSize="md"
      color="gray.200"
      sx={{
        'h1, h2, h3, h4, h5, h6': {
          fontWeight: 'bold',
          mt: 4,
          mb: 2,
          color: 'gray.100',
        },
        h1: { fontSize: 'xl' },
        h2: { fontSize: 'lg' },
        h3: { fontSize: 'md' },
        p: { mb: 3, lineHeight: 1.8 },
        'ul, ol': { pl: 5, mb: 2 },
        li: { mb: 0.5 },
        'li > ul, li > ol': { mt: 0.5 },
        a: {
          color: 'blue.300',
          textDecoration: 'underline',
          _hover: { color: 'blue.200' },
        },
        code: {
          bg: 'gray.700',
          color: 'gray.300',
          px: 1.5,
          py: 0.5,
          borderRadius: 'md',
          fontSize: 'xs',
        },
        pre: {
          bg: 'gray.900',
          p: 3,
          borderRadius: 'md',
          overflowX: 'auto',
          mb: 2,
          '& code': {
            bg: 'transparent',
            p: 0,
            fontSize: 'xs',
          },
        },
        blockquote: {
          borderLeftWidth: '3px',
          borderColor: 'gray.600',
          pl: 3,
          color: 'gray.400',
          fontStyle: 'italic',
          mb: 2,
        },
        hr: {
          borderColor: 'gray.700',
          my: 3,
        },
        table: {
          width: '100%',
          mb: 2,
        },
        'th, td': {
          borderWidth: '1px',
          borderColor: 'gray.700',
          px: 2,
          py: 1,
          fontSize: 'xs',
        },
        th: {
          bg: 'gray.800',
          fontWeight: 'bold',
        },
        'input[type="checkbox"]': {
          mr: 2,
        },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  );
}
