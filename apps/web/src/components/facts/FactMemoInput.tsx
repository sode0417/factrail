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
import { useState } from 'react';

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
  const [hovered, setHovered] = useState(false);
  const isActive = hovered || !!memoText.trim();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {/* Backdrop fade — prevents cards sliding under */}
      <Box
        position="fixed"
        left={0}
        right={0}
        bottom={0}
        h={isActive ? '240px' : '150px'}
        pointerEvents="none"
        zIndex={19}
        transition="height 0.22s ease"
        bgGradient="linear(to-b, transparent 0%, rgba(251,245,227,0.7) 28px, var(--bg) 64px, var(--bg) 100%)"
      />

      {/* Composer */}
      <Box
        position="fixed"
        bottom="20px"
        left={{
          base: '12px',
          md: 'calc(var(--sidebar-w) + clamp(20px, 3vw, 48px))',
        }}
        right={{ base: '12px', md: 'clamp(20px, 3vw, 48px)' }}
        maxW={{
          base: 'none',
          md: 'calc(1600px - 2 * clamp(20px, 3vw, 48px))',
        }}
        mx="auto"
        bg="bg.surface-2"
        borderWidth="1px"
        borderColor="border.muted"
        borderRadius="md"
        boxShadow={
          isActive
            ? '0 12px 36px rgba(74,60,20,0.14)'
            : '0 -2px 12px rgba(74,60,20,0.04), 0 6px 24px rgba(74,60,20,0.08)'
        }
        zIndex={20}
        overflow="hidden"
        transition="box-shadow 0.22s ease, border-color 0.22s ease"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        _focusWithin={{
          boxShadow: '0 12px 36px rgba(74,60,20,0.14)',
          borderColor: 'accent.soft',
        }}
      >
        {/* Toolbar: category/project/tags */}
        <Box
          bg="#E3D8B2"
          borderBottom={isActive ? '1px solid' : '0'}
          borderColor="border.muted"
          maxH={isActive ? '72px' : '0'}
          opacity={isActive ? 1 : 0}
          overflow="hidden"
          transition="max-height 0.22s ease, opacity 0.18s ease"
        >
          <Flex gap={2} align="center" px={4} py="10px" flexWrap="wrap">
            <Select
              size="xs"
              maxW="160px"
              bg="bg.canvas"
              borderColor="border.muted"
              borderRadius="sm"
              value={selectedCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">カテゴリなし</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
            {projects.length > 0 && (
              <Select
                size="xs"
                maxW="200px"
                bg="bg.canvas"
                borderColor="border.muted"
                borderRadius="sm"
                value={selectedProjectId}
                onChange={(e) => onProjectChange(e.target.value)}
              >
                <option value="">プロジェクトなし</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.title}
                  </option>
                ))}
              </Select>
            )}
            {(selectedCategoryId || selectedProjectId) && (
              <HStack spacing={1}>
                {selectedCategoryId &&
                  (() => {
                    const cat = categories.find(
                      (c) => c.id === selectedCategoryId,
                    );
                    return cat ? (
                      <Badge
                        size="sm"
                        bg={cat.color}
                        color="white"
                        fontSize="xs"
                      >
                        {cat.name}
                      </Badge>
                    ) : null;
                  })()}
                {selectedProjectId &&
                  (() => {
                    const proj = projects.find(
                      (p) => p.id === selectedProjectId,
                    );
                    return proj ? (
                      <Badge
                        size="sm"
                        bg="#D6E0E8"
                        color="#1F3A52"
                        fontSize="xs"
                      >
                        {proj.title}
                      </Badge>
                    ) : null;
                  })()}
              </HStack>
            )}
          </Flex>
        </Box>

        {/* Textarea + send */}
        <Flex gap={3} align="flex-end" px={4} py={3}>
          <Textarea
            placeholder="メモを記録… (Ctrl+Enter で送信、Shift+Enter で改行)"
            bg="bg.surface-2"
            border="0"
            _placeholder={{ color: 'text.muted' }}
            _focus={{ boxShadow: 'none', border: 0 }}
            value={memoText}
            onChange={(e) => onMemoChange(e.target.value)}
            onKeyDown={handleKeyDown}
            minH={isActive ? '84px' : '28px'}
            maxH={isActive ? '240px' : '28px'}
            rows={1}
            resize="none"
            overflow="auto"
            fontSize="14px"
            lineHeight="1.5"
            transition="min-height 0.22s ease, max-height 0.22s ease"
            p={0}
          />
          <IconButton
            aria-label="メモを送信"
            icon={<FiSend />}
            bg="accent.default"
            color="white"
            borderRadius="full"
            _hover={{ bg: 'accent.strong' }}
            size="sm"
            onClick={onSend}
            isLoading={isSending}
            isDisabled={!memoText.trim()}
            flexShrink={0}
          />
        </Flex>
      </Box>
    </>
  );
}
