'use client';

import {
  Box,
  Flex,
  HStack,
  Select,
  Badge,
  Textarea,
  IconButton,
} from '@chakra-ui/react';
import { FiSend } from 'react-icons/fi';
import type { F2ACategory, F2AProject } from '@/types/fact';

interface FactMemoInputProps {
  memoText: string;
  onMemoChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  selectedCategoryId: string;
  onCategoryChange: (value: string) => void;
  selectedProjectId: string;
  onProjectChange: (value: string) => void;
  categories: F2ACategory[];
  projects: F2AProject[];
}

export function FactMemoInput({
  memoText,
  onMemoChange,
  onSend,
  isSending,
  selectedCategoryId,
  onCategoryChange,
  selectedProjectId,
  onProjectChange,
  categories,
  projects,
}: FactMemoInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <Box
      flexShrink={0}
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.700"
      borderRadius="lg"
      p={3}
    >
      <Flex gap={2} mb={2} flexWrap="wrap">
        <Select
          size="xs"
          maxW="160px"
          bg="gray.900"
          borderColor="gray.700"
          value={selectedCategoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">カテゴリなし</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </Select>
        {projects.length > 0 && (
          <Select
            size="xs"
            maxW="200px"
            bg="gray.900"
            borderColor="gray.700"
            value={selectedProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
          >
            <option value="">プロジェクトなし</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>{proj.title}</option>
            ))}
          </Select>
        )}
        {(selectedCategoryId || selectedProjectId) && (
          <HStack spacing={1}>
            {selectedCategoryId && (() => {
              const cat = categories.find((c) => c.id === selectedCategoryId);
              return cat ? (
                <Badge size="sm" bg={cat.color} color="white" fontSize="xs">{cat.name}</Badge>
              ) : null;
            })()}
            {selectedProjectId && (() => {
              const proj = projects.find((p) => p.id === selectedProjectId);
              return proj ? (
                <Badge size="sm" colorScheme="cyan" variant="subtle" fontSize="xs">{proj.title}</Badge>
              ) : null;
            })()}
          </HStack>
        )}
      </Flex>
      <Flex gap={3} align="flex-end">
        <Textarea
          placeholder="メモを入力... (Ctrl+Enter で送信)"
          bg="gray.900"
          borderColor="gray.700"
          _placeholder={{ color: 'gray.500' }}
          _focus={{ borderColor: 'brand.500', boxShadow: 'none' }}
          value={memoText}
          onChange={(e) => onMemoChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          minH="40px"
          maxH="120px"
          resize="none"
          overflow="auto"
        />
        <IconButton
          aria-label="メモを送信"
          icon={<FiSend />}
          colorScheme="brand"
          onClick={onSend}
          isLoading={isSending}
          isDisabled={!memoText.trim()}
          flexShrink={0}
        />
      </Flex>
    </Box>
  );
}
