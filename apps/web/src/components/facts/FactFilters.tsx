'use client';

import {
  Box,
  Flex,
  Select,
  Icon,
  IconButton,
  Text,
  HStack,
} from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { useState } from 'react';
import { DateFilter } from './DateFilter';
import type { F2ACategory, F2AProject } from '@/types/fact';
import type { DatePreset } from '@/lib/dateUtils';

interface DateFilterState {
  from: string;
  to: string;
  preset: DatePreset | '';
  isActive: boolean;
  applyPreset: (preset: DatePreset) => void;
  setDateRange: (from: string, to: string) => void;
  clearFilter: () => void;
}

interface FactFiltersProps {
  sourceFilter: string;
  onSourceChange: (value: string) => void;
  filterCategoryId: string;
  onCategoryChange: (value: string) => void;
  filterProjectId: string;
  onProjectChange: (value: string) => void;
  categories: F2ACategory[];
  projects: F2AProject[];
  grouped: boolean;
  onToggleGrouped: () => void;
  loading: boolean;
  isBackgroundUpdate: boolean;
  onRefresh: () => void;
  dateFilter: DateFilterState;
}

function ChipStatus({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <HStack spacing={1.5} color="text.muted" fontSize="12px">
      <Text as="span" color="text.muted">
        {label}
      </Text>
      <Box
        as="span"
        px="10px"
        py="2px"
        borderRadius="pill"
        fontSize="11.5px"
        fontWeight={600}
        bg={active ? '#B5D2BB' : 'bg.canvas'}
        color={active ? '#1F4A30' : 'text.muted'}
        border="1px solid"
        borderColor={active ? 'transparent' : 'border.muted'}
      >
        {value}
      </Box>
    </HStack>
  );
}

export function FactFilters({
  sourceFilter,
  onSourceChange,
  filterCategoryId,
  onCategoryChange,
  filterProjectId,
  onProjectChange,
  categories,
  projects,
  loading,
  isBackgroundUpdate,
  onRefresh,
  dateFilter,
}: FactFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedCategory = categories.find((c) => c.id === filterCategoryId);
  const selectedProject = projects.find((p) => p.id === filterProjectId);

  const dateLabel = dateFilter.preset
    ? { today: '今日', thisWeek: '今週', thisMonth: '今月' }[
        dateFilter.preset as 'today' | 'thisWeek' | 'thisMonth'
      ] || '期間指定'
    : dateFilter.isActive
      ? '期間指定'
      : 'すべて';

  const sourceLabel = sourceFilter
    ? sourceFilter === 'claude-code'
      ? 'Claude Code'
      : sourceFilter.charAt(0).toUpperCase() + sourceFilter.slice(1)
    : 'すべて';

  return (
    <Box
      position="sticky"
      top="var(--topbar-h)"
      zIndex={9}
      bg="bg.canvas"
      pt="10px"
      pb="8px"
      role="group"
    >
      <Box
        position="relative"
        bg="bg.surface-2"
        border="1px solid"
        borderColor="border.muted"
        borderRadius="md"
        boxShadow={
          expanded
            ? '0 4px 14px rgba(74,60,20,0.08)'
            : '0 1px 2px rgba(74,60,20,0.04)'
        }
        minH={expanded ? '120px' : '44px'}
        px="22px"
        py={expanded ? '16px' : '10px'}
        transition="min-height 0.22s ease, padding 0.22s ease, box-shadow 0.22s ease"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Summary state */}
        <Flex
          display={expanded ? 'none' : 'flex'}
          align="center"
          gap={5}
          pointerEvents="none"
        >
          <ChipStatus
            label="期間"
            value={dateLabel}
            active={dateFilter.isActive || !!dateFilter.preset}
          />
          <Box as="span" color="border.muted">
            ·
          </Box>
          <ChipStatus
            label="ソース"
            value={sourceLabel}
            active={!!sourceFilter}
          />
          <Box as="span" color="border.muted">
            ·
          </Box>
          <ChipStatus
            label="カテゴリ"
            value={selectedCategory ? selectedCategory.name : 'すべて'}
            active={!!filterCategoryId}
          />
          {projects.length > 0 && (
            <>
              <Box as="span" color="border.muted">
                ·
              </Box>
              <ChipStatus
                label="プロジェクト"
                value={selectedProject ? selectedProject.title : 'すべて'}
                active={!!filterProjectId}
              />
            </>
          )}
          <Text
            ml="auto"
            fontSize="11px"
            color="text.muted"
            display={{ base: 'none', md: 'block' }}
          >
            ホバーで編集
          </Text>
        </Flex>

        {/* Controls state (on hover) */}
        <Box display={expanded ? 'block' : 'none'}>
          <Flex gap={3} wrap="wrap" align="center">
            <DateFilter
              from={dateFilter.from}
              to={dateFilter.to}
              preset={dateFilter.preset}
              isActive={dateFilter.isActive}
              onPreset={dateFilter.applyPreset}
              onRangeChange={dateFilter.setDateRange}
              onClear={dateFilter.clearFilter}
            />

            <Select
              size="sm"
              maxW="160px"
              bg="bg.canvas"
              borderColor="border.muted"
              borderRadius="sm"
              value={sourceFilter}
              onChange={(e) => onSourceChange(e.target.value)}
              fontSize="13px"
            >
              <option value="">すべてのソース</option>
              <option value="github">GitHub</option>
              <option value="slack">Slack</option>
              <option value="manual">Manual</option>
              <option value="browser">Browser</option>
              <option value="claude-code">Claude Code</option>
            </Select>

            <Select
              size="sm"
              maxW="160px"
              bg="bg.canvas"
              borderColor="border.muted"
              borderRadius="sm"
              value={filterCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              fontSize="13px"
            >
              <option value="">すべてのカテゴリ</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>

            {projects.length > 0 && (
              <Select
                size="sm"
                maxW="180px"
                bg="bg.canvas"
                borderColor="border.muted"
                borderRadius="sm"
                value={filterProjectId}
                onChange={(e) => onProjectChange(e.target.value)}
                fontSize="13px"
              >
                <option value="">すべてのプロジェクト</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.title}
                  </option>
                ))}
              </Select>
            )}

            <IconButton
              aria-label="更新"
              icon={
                <Icon
                  as={FiRefreshCw}
                  className={isBackgroundUpdate ? 'animate-spin' : ''}
                />
              }
              size="sm"
              variant="ghost"
              color="text.muted"
              _hover={{ bg: 'accent.soft', color: 'accent.strong' }}
              onClick={onRefresh}
              isLoading={loading}
              ml="auto"
            />
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
