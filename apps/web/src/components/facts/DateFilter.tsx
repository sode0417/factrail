'use client';

import {
  Flex,
  ButtonGroup,
  Button,
  Input,
  IconButton,
  Text,
} from '@chakra-ui/react';
import { FiX } from 'react-icons/fi';
import { DatePreset } from '@/lib/dateUtils';

interface DateFilterProps {
  from: string;
  to: string;
  preset: DatePreset | '';
  isActive: boolean;
  onPreset: (preset: DatePreset) => void;
  onRangeChange: (from: string, to: string) => void;
  onClear: () => void;
}

const presets: { key: DatePreset; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'thisWeek', label: '今週' },
  { key: 'thisMonth', label: '今月' },
];

export function DateFilter({
  from,
  to,
  preset,
  isActive,
  onPreset,
  onRangeChange,
  onClear,
}: DateFilterProps) {
  return (
    <Flex
      gap={3}
      flexWrap="wrap"
      alignItems="center"
      p={3}
      borderRadius="md"
      borderWidth="1px"
      borderColor={isActive ? 'brand.500' : 'gray.700'}
      bg="gray.900"
    >
      <ButtonGroup size="sm" isAttached variant="outline">
        {presets.map((p) => (
          <Button
            key={p.key}
            onClick={() => onPreset(p.key)}
            variant={preset === p.key ? 'solid' : 'outline'}
            colorScheme={preset === p.key ? 'brand' : 'gray'}
          >
            {p.label}
          </Button>
        ))}
      </ButtonGroup>

      <Flex alignItems="center" gap={2}>
        <Input
          type="date"
          size="sm"
          maxW={{ base: '130px', md: '160px' }}
          bg="gray.800"
          borderColor="gray.600"
          value={from}
          onChange={(e) => onRangeChange(e.target.value, to)}
          sx={{
            colorScheme: 'dark',
            '&::-webkit-calendar-picker-indicator': {
              filter: 'invert(1)',
            },
          }}
        />
        <Text color="gray.500" fontSize="sm">
          ~
        </Text>
        <Input
          type="date"
          size="sm"
          maxW={{ base: '130px', md: '160px' }}
          bg="gray.800"
          borderColor="gray.600"
          value={to}
          onChange={(e) => onRangeChange(from, e.target.value)}
          sx={{
            colorScheme: 'dark',
            '&::-webkit-calendar-picker-indicator': {
              filter: 'invert(1)',
            },
          }}
        />
      </Flex>

      {isActive && (
        <IconButton
          aria-label="フィルタをクリア"
          icon={<FiX />}
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={onClear}
        />
      )}
    </Flex>
  );
}
