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
  IconButton,
  Collapse,
  useBreakpointValue,
  useDisclosure,
  Badge,
} from '@chakra-ui/react';
import { FiSearch, FiRefreshCw, FiMessageSquare, FiFilter, FiChevronDown, FiChevronUp } from 'react-icons/fi';
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
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { isOpen: filtersOpen, onToggle: toggleFilters } = useDisclosure();

  // Count active filters for badge
  const activeFilterCount = [
    sourceFilter,
    filterCategoryId,
    filterProjectId,
    dateFilter.isActive,
  ].filter(Boolean).length;

  if (isMobile) {
    return (
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px" mb={2} flexShrink={0}>
        <CardBody py={2} px={3}>
          <Flex gap={2} align="center">
            <InputGroup size="sm" flex={1}>
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

            <IconButton
              aria-label="フィルター"
              icon={
                <Flex align="center" position="relative">
                  <Icon as={filtersOpen ? FiChevronUp : FiFilter} />
                  {activeFilterCount > 0 && !filtersOpen && (
                    <Badge
                      colorScheme="brand"
                      borderRadius="full"
                      position="absolute"
                      top="-6px"
                      right="-6px"
                      fontSize="9px"
                      minW="14px"
                      h="14px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Flex>
              }
              size="sm"
              variant={filtersOpen || activeFilterCount > 0 ? 'solid' : 'outline'}
              colorScheme={filtersOpen || activeFilterCount > 0 ? 'brand' : 'gray'}
              onClick={toggleFilters}
            />

            <IconButton
              aria-label="スレッド表示"
              icon={<Icon as={FiMessageSquare} />}
              size="sm"
              variant={grouped ? 'solid' : 'outline'}
              colorScheme={grouped ? 'brand' : 'gray'}
              onClick={onToggleGrouped}
            />

            <IconButton
              aria-label="更新"
              icon={
                <FiRefreshCw
                  className={isBackgroundUpdate ? 'animate-spin' : ''}
                />
              }
              size="sm"
              variant="outline"
              colorScheme="gray"
              onClick={onRefresh}
              isLoading={loading}
            />
          </Flex>

          <Collapse in={filtersOpen} animateOpacity>
            <VStack spacing={2} mt={2} align="stretch">
              <Flex gap={2} flexWrap="wrap">
                <Select
                  size="sm"
                  flex={1}
                  minW="120px"
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
                  size="sm"
                  flex={1}
                  minW="120px"
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
              </Flex>

              {projects.length > 0 && (
                <Select
                  size="sm"
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
          </Collapse>
        </CardBody>
      </Card>
    );
  }

  // Desktop layout (unchanged)
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
