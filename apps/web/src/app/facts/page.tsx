'use client';

import {
  Box,
  Flex,
  VStack,
  Text,
  Spinner,
  useToast,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react';
import { DateSeparator, groupFactsByDate } from '@/components/facts/DateSeparator';
import { MainLayout } from '@/components/layout';
import { FactCard, FactFilters, FactMemoInput, FactDetailDrawer } from '@/components/facts';
import type { EditFormState } from '@/components/facts';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import apiClient, { f2aClient } from '@/lib/axios';
import { useDateFilter } from '@/hooks/useDateFilter';
import type { Fact, F2ACategory, F2AProject, FactsResponse } from '@/types/fact';

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

  // メモ入力
  const [memoText, setMemoText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // スレッドコメント
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [sendingCommentId, setSendingCommentId] = useState<string | null>(null);

  // F2A カテゴリ/プロジェクト
  const [categories, setCategories] = useState<F2ACategory[]>([]);
  const [projects, setProjects] = useState<F2AProject[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');

  // インライン編集
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '', summary: '', projectId: null, categoryId: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // 削除確認
  const [deletingFact, setDeletingFact] = useState<Fact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // 詳細ドロワー
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const drawerDisclosure = useDisclosure();

  const {
    from, to, preset,
    isActive: dateFilterActive,
    setDateRange, applyPreset, clearFilter, apiParams,
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
      if (!isBackground) setLoading(true);
      else setIsBackgroundUpdate(true);

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
      if (next.has(factId)) next.delete(factId);
      else next.add(factId);
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
      toast({ title: 'メモの作成に失敗しました', status: 'error', duration: 5000, isClosable: true });
    } finally {
      setIsSending(false);
    }
  }, [memoText, isSending, fetchFacts, toast, selectedProjectId, selectedCategoryId]);

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
      const response = await apiClient.get<{ data: Fact[] }>(
        `/api/facts/${parentId}/children`,
      );
      setChildrenMap((prev) => ({ ...prev, [parentId]: response.data.data }));
      await fetchFacts(true);
    } catch (error) {
      console.error('Failed to create comment:', error);
      toast({ title: 'コメントの作成に失敗しました', status: 'error', duration: 5000, isClosable: true });
    } finally {
      setSendingCommentId(null);
    }
  }, [commentTexts, sendingCommentId, fetchFacts, toast]);

  const startEditing = useCallback((fact: Fact) => {
    setEditingFactId(fact.id);
    setEditForm({
      title: fact.title,
      summary: fact.summary || '',
      projectId: fact.projectId ?? null,
      categoryId: fact.categoryId ?? null,
    });
  }, []);

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

  const handleDelete = useCallback(async () => {
    if (!deletingFact || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/facts/${deletingFact.id}`);

      const isParent = facts.some((f) => f.id === deletingFact.id);
      if (isParent) {
        setFacts((prev) => prev.filter((f) => f.id !== deletingFact.id));
        setChildrenMap((prev) => {
          const next = { ...prev };
          delete next[deletingFact.id];
          return next;
        });
      } else {
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

  const handleOpenDetail = useCallback((fact: Fact) => {
    setSelectedFact(fact);
    drawerDisclosure.onOpen();
  }, [drawerDisclosure]);

  // 初回ロードとフィルター変更時
  useEffect(() => { fetchFacts(); }, [fetchFacts]);

  // 初回ロード完了後に最下部へスクロール
  useEffect(() => {
    if (!loading && facts.length > 0) scrollToBottom('instant');
  }, [loading, facts.length, scrollToBottom]);

  // ポーリング
  useEffect(() => {
    const intervalId = setInterval(() => fetchFacts(true), POLLING_INTERVAL);
    return () => clearInterval(intervalId);
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
      <Box px={{ base: 3, md: 6, lg: 8 }} maxW="1600px" mx="auto" w="100%">
        <FactFilters
          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}
          filterCategoryId={filterCategoryId}
          onCategoryChange={setFilterCategoryId}
          filterProjectId={filterProjectId}
          onProjectChange={setFilterProjectId}
          categories={categories}
          projects={projects}
          grouped={grouped}
          onToggleGrouped={() => {
            setGrouped((v) => !v);
            setExpandedIds(new Set());
            setChildrenMap({});
          }}
          loading={loading}
          isBackgroundUpdate={isBackgroundUpdate}
          onRefresh={() => fetchFacts(false)}
          dateFilter={{
            from, to, preset, isActive: dateFilterActive,
            applyPreset, setDateRange, clearFilter,
          }}
        />

        {/* Messages Area */}
        <Box pb="160px">
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner size="xl" color="brand.500" />
            </Flex>
          ) : filteredFacts.length === 0 ? (
            <Flex justify="center" align="center" py={10}>
              <Text color="text.muted">Factsが見つかりませんでした</Text>
            </Flex>
          ) : (
            <VStack spacing={2} align="stretch">
              {groupFactsByDate(filteredFacts).map((group) => (
                <Box key={group.label}>
                  <DateSeparator label={group.label} />
                  <VStack spacing={2} align="stretch">
                    {group.items.map((fact) => (
                      <FactCard
                        key={fact.id}
                        fact={fact}
                        grouped={grouped}
                        isExpanded={expandedIds.has(fact.id)}
                        childFacts={childrenMap[fact.id]}
                        childrenLoading={expandedIds.has(fact.id) && !childrenMap[fact.id] && (fact.childCount ?? 0) > 0}
                        onToggleExpand={() => toggleExpand(fact.id)}
                        onClickDetail={handleOpenDetail}
                        editingFactId={editingFactId}
                        editForm={editForm}
                        onEditFormChange={setEditForm}
                        onStartEditing={startEditing}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingFactId(null)}
                        isSaving={isSaving}
                        onDelete={setDeletingFact}
                        commentText={commentTexts[fact.id] || ''}
                        onCommentChange={(value) => setCommentTexts((prev) => ({ ...prev, [fact.id]: value }))}
                        onSendComment={() => handleSendComment(fact.id)}
                        sendingComment={sendingCommentId === fact.id}
                        categories={categories}
                        projects={projects}
                      />
                    ))}
                  </VStack>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </VStack>
          )}
        </Box>

      </Box>
      <FactMemoInput
        memoText={memoText}
        onMemoChange={setMemoText}
        onSend={handleSendMemo}
        isSending={isSending}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        categories={categories}
        projects={projects}
      />

      {/* 削除確認ダイアログ */}
      <AlertDialog
        isOpen={!!deletingFact}
        leastDestructiveRef={cancelDeleteRef as React.RefObject<HTMLButtonElement>}
        onClose={() => setDeletingFact(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="bg.surface" borderColor="border.muted" borderWidth="1px">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Fact を削除
            </AlertDialogHeader>
            <AlertDialogBody>
              <Text>「{deletingFact?.title}」を削除しますか？</Text>
              {deletingFact && (deletingFact.childCount ?? 0) > 0 && (
                <Text color="orange.600" mt={2} fontSize="sm">
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

      <FactDetailDrawer
        fact={selectedFact}
        isOpen={drawerDisclosure.isOpen}
        onClose={drawerDisclosure.onClose}
        categories={categories}
        projects={projects}
      />
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
