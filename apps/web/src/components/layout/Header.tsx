'use client';

import { Box, Flex, Text, IconButton, Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { FiSearch, FiBell } from 'react-icons/fi';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <Box
      as="header"
      h="80px"
      bg="gray.900"
      borderBottom="1px"
      borderColor="gray.800"
      px={8}
    >
      <Flex h="full" align="center" justify="space-between">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" fontFamily="heading">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="sm" color="gray.500" mt={1}>
              {subtitle}
            </Text>
          )}
        </Box>

        <Flex align="center" gap={4}>
          <InputGroup maxW="300px">
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray" />
            </InputLeftElement>
            <Input
              placeholder="検索..."
              bg="gray.800"
              border="none"
              _placeholder={{ color: 'gray.500' }}
              _focus={{ bg: 'gray.700', boxShadow: 'none' }}
            />
          </InputGroup>

          <IconButton
            aria-label="通知"
            icon={<FiBell />}
            variant="ghost"
            color="gray.400"
            _hover={{ bg: 'gray.800', color: 'white' }}
          />
        </Flex>
      </Flex>
    </Box>
  );
}
