'use client';

import {
  Flex,
  ButtonGroup,
  Button,
  Input,
  IconButton,
  Text,
  useBreakpointValue,
  Collapse,
  useDisclosure,
} from '@chakra-ui/react';
import { FiX, FiCalendar } from 'react-icons/fi';
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
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { isOpen: rangeOpen, onToggle: toggleRange } = useDisclosure();

  // Custom range is active (not a preset)
  const hasCustomRange = isActive && !preset;

  if (isMobile) {
    return (
      <Flex
        direction="column"
        gap={2}
        p={2}
        borderRadius="md"
        borderWidth="1px"
        borderColor={isActive ? 'brand.500' : 'border.muted'}
        bg="bg.canvas"
      >
        <Flex gap={2} align="center" flexWrap="wrap">
          <ButtonGroup size="xs" isAttached variant="outline">
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

          <IconButton
            aria-label="日付範囲"
            icon={<FiCalendar />}
            size="xs"
            variant={rangeOpen || hasCustomRange ? 'solid' : 'outline'}
            colorScheme={rangeOpen || hasCustomRange ? 'brand' : 'gray'}
            onClick={toggleRange}
          />

          {isActive && (
            <IconButton
              aria-label="フィルタをクリア"
              icon={<FiX />}
              size="xs"
              variant="ghost"
              colorScheme="gray"
              onClick={onClear}
            />
          )}
        </Flex>

        <Collapse in={rangeOpen || hasCustomRange} animateOpacity>
          <Flex alignItems="center" gap={2}>
            <Input
              type="date"
              size="xs"
              flex={1}
              bg="bg.surface"
              borderColor="border.muted"
              value={from}
              onChange={(e) => onRangeChange(e.target.value, to)}
              sx={{
                colorScheme: 'dark',
                '&::-webkit-calendar-picker-indicator': {
                  filter: 'invert(1)',
                },
              }}
            />
            <Text color="text.muted" fontSize="xs">
              ~
            </Text>
            <Input
              type="date"
              size="xs"
              flex={1}
              bg="bg.surface"
              borderColor="border.muted"
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
        </Collapse>
      </Flex>
    );
  }

  // Desktop layout (unchanged)
  return (
    <Flex
      gap={3}
      flexWrap="wrap"
      alignItems="center"
      p={3}
      borderRadius="md"
      borderWidth="1px"
      borderColor={isActive ? 'brand.500' : 'border.muted'}
      bg="bg.canvas"
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
          bg="bg.surface"
          borderColor="border.muted"
          value={from}
          onChange={(e) => onRangeChange(e.target.value, to)}
          sx={{
            colorScheme: 'dark',
            '&::-webkit-calendar-picker-indicator': {
              filter: 'invert(1)',
            },
          }}
        />
        <Text color="text.muted" fontSize="sm">
          ~
        </Text>
        <Input
          type="date"
          size="sm"
          maxW={{ base: '130px', md: '160px' }}
          bg="bg.surface"
          borderColor="border.muted"
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
