'use client';

import {
  Card,
  CardBody,
  VStack,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Icon,
} from '@chakra-ui/react';
import { FiSearch, FiRefreshCw, FiMessageSquare } from 'react-icons/fi';
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
  searchQuery: string;
  onSearchChange: (value: string) => void;
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

export function FactFilters({
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceChange,
  filterCategoryId,
  onCategoryChange,
  filterProjectId,
  onProjectChange,
  categories,
  projects,
  grouped,
  onToggleGrouped,
  loading,
  isBackgroundUpdate,
  onRefresh,
  dateFilter,
}: FactFiltersProps) {
  return (
    <Card bg="gray.800" borderColor="gray.700" borderWidth="1px" mb={4} flexShrink={0}>
      <CardBody py={3}>
        <VStack spacing={3} align="stretch">
          <Flex gap={{ base: 2, md: 4 }} flexWrap="wrap">
            <InputGroup maxW={{ base: '100%', md: '300px' }}>
              <InputLeftElement pointerEvents="none">
                <FiSearch color="gray" />
              </InputLeftElement>
              <Input
                placeholder="検索..."
                bg="gray.900"
                border="none"
                _placeholder={{ color: 'gray.500' }}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </InputGroup>

            <Select
              maxW={{ base: '100%', sm: '200px' }}
              bg="gray.900"
              borderColor="gray.700"
              value={sourceFilter}
              onChange={(e) => onSourceChange(e.target.value)}
            >
              <option value="">すべてのソース</option>
              <option value="github">GitHub</option>
              <option value="slack">Slack</option>
              <option value="manual">Manual</option>
              <option value="browser">Browser</option>
              <option value="claude-code">Claude Code</option>
            </Select>

            <Select
              maxW={{ base: '100%', sm: '160px' }}
              bg="gray.900"
              borderColor="gray.700"
              value={filterCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">すべてのカテゴリ</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>

            {projects.length > 0 && (
              <Select
                maxW={{ base: '100%', sm: '200px' }}
                bg="gray.900"
                borderColor="gray.700"
                value={filterProjectId}
                onChange={(e) => onProjectChange(e.target.value)}
              >
                <option value="">すべてのプロジェクト</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.title}</option>
                ))}
              </Select>
            )}

            <Button
              leftIcon={<Icon as={FiMessageSquare} />}
              variant={grouped ? 'solid' : 'outline'}
              colorScheme={grouped ? 'brand' : 'gray'}
              onClick={onToggleGrouped}
            >
              スレッド表示
            </Button>

            <Button
              leftIcon={
                <FiRefreshCw
                  className={isBackgroundUpdate ? 'animate-spin' : ''}
                />
              }
              variant="outline"
              colorScheme="gray"
              onClick={onRefresh}
              isLoading={loading}
            >
              更新
            </Button>
          </Flex>

          <DateFilter
            from={dateFilter.from}
            to={dateFilter.to}
            preset={dateFilter.preset}
            isActive={dateFilter.isActive}
            onPreset={dateFilter.applyPreset}
            onRangeChange={dateFilter.setDateRange}
            onClear={dateFilter.clearFilter}
          />
        </VStack>
      </CardBody>
    </Card>
  );
}
