'use client';

import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Badge,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Spinner,
  Icon,
  Divider,
  IconButton,
  Textarea,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { DateFilter } from '@/components/facts';
import { FiSearch, FiExternalLink, FiRefreshCw, FiMessageSquare, FiChevronDown, FiChevronRight, FiSend, FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import apiClient, { f2aClient } from '@/lib/axios';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { useDateFilter } from '@/hooks/useDateFilter';

interface Fact {
  id: string;
  externalId: string;
  source: string;
  sourceUrl: string | null;
  occurredAt: string;
  title: string;
  summary: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  groupId?: string | null;
  groupType?: string | null;
  projectId?: string | null;
  categoryId?: string | null;
  childCount?: number;
}

interface F2ACategory {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface F2AProject {
  id: string;
  title: string;
  status: string;
  category_id: string | null;
}

interface FactsResponse {
  data: Fact[];
  meta: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'github':
      return 'purple';
    case 'slack':
      return 'green';
    case 'manual':
      return 'blue';
    default:
      return 'gray';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ポーリング間隔（30秒）
const POLLING_INTERVAL = 30000;

function FactsPageContent() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackgroundUpdate, setIsBackgroundUpdate] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, Fact[]>>({});

  // チャット入力
  const [memoText, setMemoText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // スレッドコメント入力
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [sendingCommentId, setSendingCommentId] = useState<string | null>(null);

  // F2A カテゴリ/プロジェクト
  const [categories, setCategories] = useState<F2ACategory[]>([]);
  const [projects, setProjects] = useState<F2AProject[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // フィルタ用カテゴリ/プロジェクト
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');

  // インライン編集
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    summary: string;
    projectId: string | null;
    categoryId: string | null;
  }>({ title: '', summary: '', projectId: null, categoryId: null });
  const [isSaving, setIsSaving] = useState(false);

  // 削除確認
  const [deletingFact, setDeletingFact] = useState<Fact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const {
    from,
    to,
    preset,
    isActive: dateFilterActive,
    setDateRange,
    applyPreset,
    clearFilter,
    apiParams,
  } = useDateFilter();

  // F2A カテゴリ/プロジェクト取得
  useEffect(() => {
    const fetchF2AData = async () => {
      try {
        const [catRes, projRes] = await Promise.all([
          f2aClient.get<{ data: F2ACategory[] }>('/api/categories'),
          f2aClient.get<{ data: F2AProject[] }>('/api/projects'),
        ]);
        setCategories(catRes.data.data);
        setProjects(projRes.data.data);
      } catch (error) {
        console.error('Failed to fetch F2A data:', error);
      }
    };
    fetchF2AData();
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const fetchFacts = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoading(true);
      } else {
        setIsBackgroundUpdate(true);
      }

      try {
        const params = new URLSearchParams();
        if (sourceFilter) params.append('source', sourceFilter);
        if (apiParams.from) params.append('from', apiParams.from);
        if (apiParams.to) params.append('to', apiParams.to);
        if (grouped) params.append('grouped', 'true');
        if (filterCategoryId) params.append('categoryId', filterCategoryId);
        if (filterProjectId) params.append('projectId', filterProjectId);

        const response = await apiClient.get<FactsResponse>(
          `/api/facts?${params.toString()}`,
        );
        // API は occurredAt desc で返すので、チャット表示用に逆順（古い順）にする
        setFacts([...response.data.data].reverse());
      } catch (error) {
        console.error('Failed to fetch facts:', error);
      } finally {
        setLoading(false);
        setIsBackgroundUpdate(false);
      }
    },
    [sourceFilter, apiParams.from, apiParams.to, grouped, filterCategoryId, filterProjectId],
  );

  const toggleExpand = useCallback(async (factId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(factId)) {
        next.delete(factId);
      } else {
        next.add(factId);
      }
      return next;
    });

    if (!childrenMap[factId]) {
      try {
        const response = await apiClient.get<{ data: Fact[] }>(
          `/api/facts/${factId}/children`,
        );
        setChildrenMap((prev) => ({ ...prev, [factId]: response.data.data }));
      } catch (error) {
        console.error('Failed to fetch children:', error);
      }
    }
  }, [childrenMap]);

  // メモ送信
  const handleSendMemo = useCallback(async () => {
    const text = memoText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      await apiClient.post('/api/facts', {
        source: 'manual',
        title: text,
        type: 'memo',
        ...(selectedProjectId && { projectId: selectedProjectId }),
        ...(selectedCategoryId && { categoryId: selectedCategoryId }),
      });
      setMemoText('');
      await fetchFacts(false);
    } catch (error) {
      console.error('Failed to create memo:', error);
      toast({
        title: 'メモの作成に失敗しました',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSending(false);
    }
  }, [memoText, isSending, fetchFacts, toast, selectedProjectId, selectedCategoryId]);

  // スレッドコメント送信
  const handleSendComment = useCallback(async (parentId: string) => {
    const text = (commentTexts[parentId] || '').trim();
    if (!text || sendingCommentId) return;

    setSendingCommentId(parentId);
    try {
      await apiClient.post('/api/facts', {
        source: 'comment',
        title: text,
        type: 'comment',
        parentId,
      });
      setCommentTexts((prev) => ({ ...prev, [parentId]: '' }));
      // スレッドの children を再取得
      const response = await apiClient.get<{ data: Fact[] }>(
        `/api/facts/${parentId}/children`,
      );
      setChildrenMap((prev) => ({ ...prev, [parentId]: response.data.data }));
      // 親の childCount を更新
      await fetchFacts(true);
    } catch (error) {
      console.error('Failed to create comment:', error);
      toast({
        title: 'コメントの作成に失敗しました',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSendingCommentId(null);
    }
  }, [commentTexts, sendingCommentId, fetchFacts, toast]);

  // Ctrl+Enter / Cmd+Enter で送信
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMemo();
    }
  }, [handleSendMemo]);

  // インライン編集開始
  const startEditing = useCallback((fact: Fact) => {
    setEditingFactId(fact.id);
    setEditForm({
      title: fact.title,
      summary: fact.summary || '',
      projectId: fact.projectId ?? null,
      categoryId: fact.categoryId ?? null,
    });
  }, []);

  // 編集保存
  const handleSaveEdit = useCallback(async (factId: string, parentId?: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await apiClient.patch(`/api/facts/${factId}`, {
        title: editForm.title,
        summary: editForm.summary || null,
        projectId: editForm.projectId,
        categoryId: editForm.categoryId,
      });
      const updated = res.data.data;

      if (parentId) {
        // 子 Fact の更新
        setChildrenMap((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).map((c) => (c.id === factId ? { ...c, ...updated } : c)),
        }));
      } else {
        setFacts((prev) => prev.map((f) => (f.id === factId ? { ...f, ...updated } : f)));
      }

      setEditingFactId(null);
    } catch (error) {
      console.error('Failed to update fact:', error);
      toast({ title: '更新に失敗しました', status: 'error', duration: 5000, isClosable: true });
    } finally {
      setIsSaving(false);
    }
  }, [editForm, isSaving, toast]);

  // 削除実行
  const handleDelete = useCallback(async () => {
    if (!deletingFact || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/facts/${deletingFact.id}`);

      // 親 Fact かどうかで state 更新を分岐
      const isParent = facts.some((f) => f.id === deletingFact.id);
      if (isParent) {
        setFacts((prev) => prev.filter((f) => f.id !== deletingFact.id));
        setChildrenMap((prev) => {
          const next = { ...prev };
          delete next[deletingFact.id];
          return next;
        });
      } else {
        // 子 Fact の削除 → childrenMap から除去し、親の childCount を更新
        let affectedParentId: string | null = null;
        setChildrenMap((prev) => {
          const next = { ...prev };
          for (const [parentId, children] of Object.entries(next)) {
            const filtered = children.filter((c) => c.id !== deletingFact.id);
            if (filtered.length !== children.length) {
              next[parentId] = filtered;
              affectedParentId = parentId;
            }
          }
          return next;
        });
        if (affectedParentId) {
          setFacts((prevFacts) =>
            prevFacts.map((f) =>
              f.id === affectedParentId ? { ...f, childCount: (f.childCount ?? 1) - 1 } : f,
            ),
          );
        }
      }

      setDeletingFact(null);
    } catch (error) {
      console.error('Failed to delete fact:', error);
      toast({ title: '削除に失敗しました', status: 'error', duration: 5000, isClosable: true });
    } finally {
      setIsDeleting(false);
    }
  }, [deletingFact, isDeleting, facts, toast]);

  // 初回ロードとフィルター変更時のフェッチ
  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  // 初回ロード完了後に最下部へスクロール
  useEffect(() => {
    if (!loading && facts.length > 0) {
      scrollToBottom('instant');
    }
  }, [loading, facts.length, scrollToBottom]);

  // 30秒ごとのポーリング
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchFacts(true);
    }, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchFacts]);

  const filteredFacts = facts.filter((fact) => {
    if (!searchQuery) return true;
    return (
      fact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fact.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fact.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <MainLayout title="Facts" subtitle="収集されたすべてのファクトを表示">
      <Flex direction="column" h="calc(100vh - 140px)" maxH="calc(100vh - 140px)">
        {/* Filters */}
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>

                <Select
                  maxW={{ base: '100%', sm: '200px' }}
                  bg="gray.900"
                  borderColor="gray.700"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="">すべてのソース</option>
                  <option value="github">GitHub</option>
                  <option value="slack">Slack</option>
                  <option value="manual">Manual</option>
                </Select>

                <Select
                  maxW={{ base: '100%', sm: '160px' }}
                  bg="gray.900"
                  borderColor="gray.700"
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
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
                    onChange={(e) => setFilterProjectId(e.target.value)}
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
                  onClick={() => {
                    setGrouped((v) => !v);
                    setExpandedIds(new Set());
                    setChildrenMap({});
                  }}
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
                  onClick={() => fetchFacts(false)}
                  isLoading={loading}
                >
                  更新
                </Button>
              </Flex>

              <DateFilter
                from={from}
                to={to}
                preset={preset}
                isActive={dateFilterActive}
                onPreset={applyPreset}
                onRangeChange={setDateRange}
                onClear={clearFilter}
              />
            </VStack>
          </CardBody>
        </Card>

        {/* Messages Area (scrollable) */}
        <Box
          ref={scrollContainerRef}
          flex={1}
          overflowY="auto"
          mb={4}
          sx={{
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { bg: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bg: 'gray.700', borderRadius: 'full' },
          }}
        >
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner size="xl" color="brand.500" />
            </Flex>
          ) : filteredFacts.length === 0 ? (
            <Flex justify="center" align="center" py={10}>
              <Text color="gray.500">Factsが見つかりませんでした</Text>
            </Flex>
          ) : (
            <VStack spacing={3} align="stretch">
              {filteredFacts.map((fact) => {
                const childCount = fact.childCount ?? 0;
                const hasChildren = grouped && childCount > 0;
                const isExpanded = expandedIds.has(fact.id);
                const children = childrenMap[fact.id];

                return (
                  <Card
                    key={fact.id}
                    bg="gray.800"
                    borderColor="gray.700"
                    borderWidth="1px"
                    _hover={{ borderColor: 'gray.600' }}
                    transition="all 0.2s"
                    overflow="hidden"
                  >
                    <CardBody pb={grouped ? 0 : undefined}>
                      {/* 親 Fact */}
                      {editingFactId === fact.id ? (
                        /* インライン編集モード */
                        <VStack spacing={3} align="stretch">
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                            bg="gray.900"
                            borderColor="gray.600"
                            fontWeight="semibold"
                            fontSize="lg"
                            placeholder="タイトル"
                          />
                          <Textarea
                            value={editForm.summary}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, summary: e.target.value }))}
                            bg="gray.900"
                            borderColor="gray.600"
                            fontSize="sm"
                            placeholder="サマリー（任意）"
                            rows={2}
                            resize="none"
                          />
                          <HStack spacing={2}>
                            <Select
                              size="sm"
                              maxW="180px"
                              bg="gray.900"
                              borderColor="gray.600"
                              value={editForm.categoryId ?? ''}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, categoryId: e.target.value || null }))}
                            >
                              <option value="">カテゴリなし</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </Select>
                            {projects.length > 0 && (
                              <Select
                                size="sm"
                                maxW="220px"
                                bg="gray.900"
                                borderColor="gray.600"
                                value={editForm.projectId ?? ''}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, projectId: e.target.value || null }))}
                              >
                                <option value="">プロジェクトなし</option>
                                {projects.map((proj) => (
                                  <option key={proj.id} value={proj.id}>{proj.title}</option>
                                ))}
                              </Select>
                            )}
                          </HStack>
                          <HStack spacing={2}>
                            <IconButton
                              aria-label="保存"
                              icon={<FiCheck />}
                              colorScheme="green"
                              size="sm"
                              onClick={() => handleSaveEdit(fact.id)}
                              isLoading={isSaving}
                              isDisabled={!editForm.title.trim()}
                            />
                            <IconButton
                              aria-label="キャンセル"
                              icon={<FiX />}
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingFactId(null)}
                            />
                          </HStack>
                        </VStack>
                      ) : (
                        /* 通常表示モード */
                        <Flex justify="space-between" align="flex-start">
                          <HStack spacing={3} align="flex-start" flex={1}>
                            <Box
                              w={1}
                              minH="50px"
                              borderRadius="full"
                              bg={`${getSourceColor(fact.source)}.500`}
                              flexShrink={0}
                            />
                            <Box flex={1}>
                              <Text fontWeight="semibold" fontSize="lg" mb={1}>
                                {fact.title}
                              </Text>
                              {fact.summary && (
                                <Text fontSize="sm" color="gray.400" mb={2}>
                                  {fact.summary}
                                </Text>
                              )}
                              <HStack spacing={2} flexWrap="wrap">
                                <Badge
                                  colorScheme={getSourceColor(fact.source)}
                                  variant="subtle"
                                >
                                  {fact.source}
                                </Badge>
                                <Badge colorScheme="gray" variant="outline">
                                  {fact.type}
                                </Badge>
                                {fact.categoryId && (() => {
                                  const cat = categories.find((c) => c.id === fact.categoryId);
                                  return cat ? (
                                    <Badge bg={cat.color} color="white" fontSize="xs">{cat.name}</Badge>
                                  ) : null;
                                })()}
                                {fact.projectId && (() => {
                                  const proj = projects.find((p) => p.id === fact.projectId);
                                  return proj ? (
                                    <Badge colorScheme="cyan" variant="subtle" fontSize="xs">{proj.title}</Badge>
                                  ) : null;
                                })()}
                                <Text fontSize="xs" color="gray.500">
                                  {formatRelativeTime(fact.occurredAt)} (
                                  {formatDate(fact.occurredAt)})
                                </Text>
                              </HStack>
                            </Box>
                          </HStack>

                          <HStack spacing={1} flexShrink={0}>
                            {(fact.source === 'manual' || fact.source === 'comment') && (
                              <>
                                <IconButton
                                  aria-label="編集"
                                  icon={<FiEdit2 />}
                                  size="sm"
                                  variant="ghost"
                                  colorScheme="gray"
                                  onClick={() => startEditing(fact)}
                                />
                                <IconButton
                                  aria-label="削除"
                                  icon={<FiTrash2 />}
                                  size="sm"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => setDeletingFact(fact)}
                                />
                              </>
                            )}
                            {fact.sourceUrl && (
                              <Button
                                as="a"
                                href={fact.sourceUrl}
                                target="_blank"
                                size="sm"
                                variant="ghost"
                                colorScheme="gray"
                                rightIcon={<Icon as={FiExternalLink} />}
                              >
                                開く
                              </Button>
                            )}
                          </HStack>
                        </Flex>
                      )}

                      {/* スレッドバー */}
                      {grouped && (
                        <Box mt={3}>
                          <Divider borderColor="gray.700" />
                          <Flex
                            align="center"
                            py={2.5}
                            px={2}
                            mx={-2}
                            mt={1}
                            cursor="pointer"
                            borderRadius="md"
                            _hover={{ bg: 'gray.700' }}
                            onClick={() => toggleExpand(fact.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <Icon
                              as={FiMessageSquare}
                              color={hasChildren ? 'brand.400' : 'gray.500'}
                              boxSize={4}
                              mr={2}
                            />
                            <Text fontSize="sm" color={hasChildren ? 'brand.400' : 'gray.500'} fontWeight="medium">
                              {hasChildren ? `${childCount}件の関連イベント` : 'コメントを追加'}
                            </Text>
                            <Icon
                              as={isExpanded ? FiChevronDown : FiChevronRight}
                              color="gray.500"
                              boxSize={4}
                              ml={2}
                            />
                          </Flex>
                        </Box>
                      )}
                    </CardBody>

                    {/* スレッド展開（カード内インライン） */}
                    {grouped && isExpanded && (
                      <Box bg="gray.850" borderTop="1px" borderColor="gray.700">
                        {hasChildren && !children ? (
                          <Flex justify="center" py={4}>
                            <Spinner size="sm" color="gray.500" />
                          </Flex>
                        ) : (
                          <VStack spacing={0} align="stretch" px={5} py={3}>
                            {children && children.map((child, idx) => (
                              <Flex key={child.id} align="stretch">
                                {/* タイムライン縦線 + ドット */}
                                <Flex direction="column" align="center" mr={3} flexShrink={0}>
                                  <Box
                                    w="8px"
                                    h="8px"
                                    borderRadius="full"
                                    bg={`${getSourceColor(child.source)}.500`}
                                    mt="6px"
                                    flexShrink={0}
                                  />
                                  {idx < children.length - 1 && (
                                    <Box
                                      w="2px"
                                      flex={1}
                                      bg="gray.600"
                                      mt={1}
                                    />
                                  )}
                                </Flex>

                                {/* 子 Fact 内容 */}
                                <Box flex={1} pb={idx < children.length - 1 ? 3 : 0}>
                                  {editingFactId === child.id ? (
                                    <VStack spacing={2} align="stretch">
                                      <Input
                                        value={editForm.title}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                        bg="gray.900"
                                        borderColor="gray.600"
                                        size="sm"
                                        placeholder="タイトル"
                                      />
                                      <HStack spacing={2}>
                                        <IconButton
                                          aria-label="保存"
                                          icon={<FiCheck />}
                                          colorScheme="green"
                                          size="xs"
                                          onClick={() => handleSaveEdit(child.id, fact.id)}
                                          isLoading={isSaving}
                                          isDisabled={!editForm.title.trim()}
                                        />
                                        <IconButton
                                          aria-label="キャンセル"
                                          icon={<FiX />}
                                          variant="ghost"
                                          size="xs"
                                          onClick={() => setEditingFactId(null)}
                                        />
                                      </HStack>
                                    </VStack>
                                  ) : (
                                    <Flex justify="space-between" align="flex-start">
                                      <Box flex={1}>
                                        <Text fontWeight="medium" fontSize="sm" color="gray.200">
                                          {child.title}
                                        </Text>
                                        <HStack spacing={2} mt={1} flexWrap="wrap">
                                          <Badge colorScheme="gray" variant="outline" fontSize="xs">
                                            {child.type}
                                          </Badge>
                                          <Text fontSize="xs" color="gray.500">
                                            {formatRelativeTime(child.occurredAt)}
                                          </Text>
                                        </HStack>
                                      </Box>
                                      <HStack spacing={0} flexShrink={0} ml={2}>
                                        {(child.source === 'manual' || child.source === 'comment') && (
                                          <>
                                            <IconButton
                                              aria-label="編集"
                                              icon={<FiEdit2 />}
                                              size="xs"
                                              variant="ghost"
                                              colorScheme="gray"
                                              onClick={() => startEditing(child)}
                                            />
                                            <IconButton
                                              aria-label="削除"
                                              icon={<FiTrash2 />}
                                              size="xs"
                                              variant="ghost"
                                              colorScheme="red"
                                              onClick={() => setDeletingFact(child)}
                                            />
                                          </>
                                        )}
                                        {child.sourceUrl && (
                                          <Button
                                            as="a"
                                            href={child.sourceUrl}
                                            target="_blank"
                                            size="xs"
                                            variant="ghost"
                                            colorScheme="gray"
                                            rightIcon={<Icon as={FiExternalLink} boxSize={3} />}
                                          >
                                            開く
                                          </Button>
                                        )}
                                      </HStack>
                                    </Flex>
                                  )}
                                </Box>
                              </Flex>
                            ))}

                            {/* コメント入力 */}
                            <Flex mt={children && children.length > 0 ? 3 : 0} gap={2} align="flex-end">
                              <Input
                                placeholder="コメントを入力..."
                                bg="gray.900"
                                borderColor="gray.700"
                                _placeholder={{ color: 'gray.500' }}
                                _focus={{ borderColor: 'brand.500', boxShadow: 'none' }}
                                size="sm"
                                value={commentTexts[fact.id] || ''}
                                onChange={(e) => setCommentTexts((prev) => ({ ...prev, [fact.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleSendComment(fact.id);
                                  }
                                }}
                              />
                              <IconButton
                                aria-label="コメントを送信"
                                icon={<FiSend />}
                                colorScheme="brand"
                                size="sm"
                                onClick={() => handleSendComment(fact.id)}
                                isLoading={sendingCommentId === fact.id}
                                isDisabled={!(commentTexts[fact.id] || '').trim()}
                              />
                            </Flex>
                          </VStack>
                        )}
                      </Box>
                    )}
                  </Card>
                );
              })}
              <div ref={messagesEndRef} />
            </VStack>
          )}
        </Box>

        {/* Chat Input Bar */}
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
              onChange={(e) => setSelectedCategoryId(e.target.value)}
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
                onChange={(e) => setSelectedProjectId(e.target.value)}
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
              onChange={(e) => setMemoText(e.target.value)}
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
              onClick={handleSendMemo}
              isLoading={isSending}
              isDisabled={!memoText.trim()}
              flexShrink={0}
            />
          </Flex>
        </Box>
      </Flex>

      {/* 削除確認ダイアログ */}
      <AlertDialog
        isOpen={!!deletingFact}
        leastDestructiveRef={cancelDeleteRef as React.RefObject<HTMLButtonElement>}
        onClose={() => setDeletingFact(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" borderColor="gray.700" borderWidth="1px">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Fact を削除
            </AlertDialogHeader>
            <AlertDialogBody>
              <Text>「{deletingFact?.title}」を削除しますか？</Text>
              {deletingFact && (deletingFact.childCount ?? 0) > 0 && (
                <Text color="orange.300" mt={2} fontSize="sm">
                  スレッド内の {deletingFact.childCount} 件のコメントも削除されます。
                </Text>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelDeleteRef} onClick={() => setDeletingFact(null)} variant="ghost">
                キャンセル
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3} isLoading={isDeleting}>
                削除
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </MainLayout>
  );
}

export default function FactsPage() {
  return (
    <Suspense
      fallback={
        <MainLayout title="Facts" subtitle="収集されたすべてのファクトを表示">
          <Flex justify="center" py={10}>
            <Spinner size="xl" color="brand.500" />
          </Flex>
        </MainLayout>
      }
    >
      <FactsPageContent />
    </Suspense>
  );
}
