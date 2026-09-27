'use client';

// 🔴🔴 この 'use client' を外さないこと。
//
//   `sode0417/factrail` は PUBLIC で、`factrail.sode-ai.com` のページ自体は
//   ログイン無しで誰でも開ける（`apps/web` に `middleware.ts` は無い）。
//   いま中身が漏れていないのは「ページが殻で、データはブラウザから API を叩いて
//   取る。その API はクッキーが無ければ 401」という形になっているから。
//
//   サーバコンポーネントにすると（＝この 1 行を消すだけで）Next.js はサーバ側で
//   F2A を叩き、読書メモの本文を HTML に埋めて誰にでも配る。
//   ⛔ 同じ理由で、このページで `getServerSideProps` 相当のサーバ取得や、
//      データを焼き込む静的生成をしない。
//
//   確かめ方: `curl` でこのページを取り、HTML にメモの本文が 1 文字も出ていない
//   ことを見る。ブラウザで見て「ログイン画面が出た」は検証にならない（ブラウザは
//   クッキーを持っているかもしれない）。

import { Box, Button, Flex, Icon, Spinner, Text, VStack } from '@chakra-ui/react';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { MemoCard, MemoImportButton, MemoSourceHeader } from '@/components/memos';
import { fetchMemoDetail, fetchMemoPage } from '@/lib/memos';
import type { MemoDetail, MemoSource } from '@/types/memo';

/**
 * 読み込みの状態。
 *
 * 🔴 `empty`（まだ 1 件も無い）と `error`（読み込めなかった）を必ず別に持つ。
 *    ひとつにまとめると、F2A に繋がっていないことに気づけないまま
 *    「まだありません」と表示し続ける。
 *    📏 2026-09-27 に実際に効いた: F2A に 5 件 入っているのに読み出し口が無い状態で、
 *    「まだありません」と出していたら取り込みの失敗と誤解するところだった。
 */
type Status = 'loading' | 'ready' | 'error';

export default function MemosPage() {
  const [sources, setSources] = useState<MemoSource[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // ⚠️ カーソルが壊れて先頭から読み直したことを、黙って隠さない
  const [restarted, setRestarted] = useState(false);

  // 開いている素材と、その中身
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailMap, setDetailMap] = useState<Record<string, MemoDetail>>({});
  const [detailErrorIds, setDetailErrorIds] = useState<Set<string>>(new Set());

  // ⚠️ 同期の setState を持たないこと —— effect から呼ぶため
  //    (react-hooks/set-state-in-effect)。状態の切り替えは await の後だけ。
  const loadFirstPage = useCallback(async () => {
    try {
      const page = await fetchMemoPage();
      setSources(page.items);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setRestarted(page.restarted);
      setStatus('ready');
    } catch (error) {
      console.error('読書メモの取得に失敗しました', error);
      setSources([]);
      setHasMore(false);
      setNextCursor(null);
      setStatus('error');
    }
  }, []);

  // ⭐ 読み込み表示の切り替え（同期の setState）は「取得を始めた出来事」の側に置く。
  //    effect の本体では待つだけ —— facts ページと同じ形。
  useEffect(() => {
    void (async () => {
      await loadFirstPage();
    })();
  }, [loadFirstPage]);

  const retry = useCallback(() => {
    setStatus('loading');
    setExpandedIds(new Set());
    setDetailMap({});
    setDetailErrorIds(new Set());
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchMemoPage(nextCursor);
      // ⚠️ 先頭から読み直された場合は積まずに差し替える（⛔ 重複を作らない）
      setSources((prev) => (page.restarted ? page.items : [...prev, ...page.items]));
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setRestarted(page.restarted);
    } catch (error) {
      console.error('続きの取得に失敗しました', error);
      // ⛔ すでに出ている分は消さない。続きが取れなかったことだけ伝える
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  const toggleExpand = useCallback(
    async (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

      if (detailMap[id]) return;

      try {
        const detail = await fetchMemoDetail(id);
        setDetailMap((prev) => ({ ...prev, [id]: detail }));
        setDetailErrorIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (error) {
        console.error('ハイライトの取得に失敗しました', error);
        // 🔴 「0 件だった」と「取れなかった」を混ぜない
        setDetailErrorIds((prev) => new Set(prev).add(id));
      }
    },
    [detailMap],
  );

  return (
    <MainLayout title="メモ" subtitle="素材ごとにハイライトとメモをまとめる">
      <Box px={{ base: 3, md: 6, lg: 8 }} py={6} maxW="1600px" mx="auto" w="100%">
        {/* ⭐ 取り込みは一覧の読み込みとは独立。読み込めていなくても取り込めるよう、
            状態に関係なく常に出す */}
        <MemoImportButton onImported={retry} />

        {restarted && (
          <Flex
            align="center"
            gap={2}
            mb={3}
            px={3}
            py={2}
            bg="bg.surface-2"
            borderRadius="sm"
            data-testid="memos-restarted"
          >
            <Icon as={FiInfo} boxSize="14px" color="text.muted" />
            <Text fontSize="12px" color="text.muted">
              続きの位置が分からなくなったので、最初から読み直しました。
            </Text>
          </Flex>
        )}

        {status === 'loading' && (
          <Flex justify="center" py={10}>
            <Spinner size="xl" color="brand.500" />
          </Flex>
        )}

        {status === 'error' && (
          <Flex direction="column" align="center" gap={3} py={10} data-testid="memos-error">
            <Text color="text.default" fontWeight={600}>
              読書メモを読み込めませんでした
            </Text>
            <Text color="text.muted" fontSize="sm" textAlign="center">
              F2A に繋がらなかったか、ログインが切れています。
              <br />
              件数が 0 なのではなく、取りに行けていません。
            </Text>
            <Button size="sm" variant="outline" onClick={retry}>
              もう一度試す
            </Button>
          </Flex>
        )}

        {status === 'ready' && sources.length === 0 && (
          <Flex direction="column" align="center" gap={2} py={10} data-testid="memos-empty">
            <Text color="text.default" fontWeight={600}>
              読書メモはまだ 1 件もありません
            </Text>
            <Text color="text.muted" fontSize="sm" textAlign="center">
              F2A への問い合わせは成功しています。取り込みが済むとここに並びます。
            </Text>
          </Flex>
        )}

        {status === 'ready' && sources.length > 0 && (
          <VStack spacing={3} align="stretch" data-testid="memos-list">
            {/* 🔴 並べ替えをしない。F2A が返した順のまま描く
                （F2A 側が MAX(highlighted_at) → created_at → 件数 → id で解決済み） */}
            {sources.map((source) => {
              const isExpanded = expandedIds.has(source.id);
              const detail = detailMap[source.id];
              const failed = detailErrorIds.has(source.id);

              return (
                <Box key={source.id}>
                  <MemoSourceHeader
                    source={source}
                    isExpanded={isExpanded}
                    onToggle={() => void toggleExpand(source.id)}
                  />

                  {isExpanded && (
                    <Box mt={2} pl={{ base: 0, md: 6 }}>
                      {failed ? (
                        <Flex
                          align="center"
                          gap={2}
                          px={4}
                          py={3}
                          bg="#FBEFE4"
                          border="1px solid"
                          borderColor="#E0965A"
                          borderRadius="md"
                          data-testid="memo-detail-error"
                        >
                          <Icon as={FiAlertTriangle} color="#B4652A" boxSize="14px" />
                          <Text fontSize="12px" color="#8A4A18">
                            ハイライトを読み込めませんでした（0 件なのではありません）
                          </Text>
                        </Flex>
                      ) : !detail ? (
                        <Flex justify="center" py={4}>
                          <Spinner size="sm" color="brand.500" />
                        </Flex>
                      ) : detail.memos.length === 0 ? (
                        <Text fontSize="12px" color="text.muted" px={4} py={3}>
                          この素材にハイライトは入っていません。
                        </Text>
                      ) : (
                        <VStack spacing={2} align="stretch">
                          {/* 🔴 返っていないハイライトがあることを黙って隠さない */}
                          {detail.truncated && (
                            <Flex
                              align="center"
                              gap={2}
                              px={3}
                              py={2}
                              bg="#FBEFE4"
                              border="1px solid"
                              borderColor="#E0965A"
                              borderRadius="sm"
                              data-testid="memo-highlights-truncated"
                            >
                              <Icon as={FiAlertTriangle} color="#B4652A" boxSize="14px" />
                              <Text fontSize="12px" color="#8A4A18">
                                ハイライトが多いため、ここに出ているのは一部です
                                （全 {source.highlightCount} 件）。
                              </Text>
                            </Flex>
                          )}
                          {detail.memos.map((memo) => (
                            <MemoCard key={memo.id} memo={memo} />
                          ))}
                        </VStack>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}

            {hasMore && (
              <Flex justify="center" pt={2}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadMore()}
                  isLoading={loadingMore}
                  loadingText="読み込み中"
                  data-testid="memos-load-more"
                >
                  もっと読む
                </Button>
              </Flex>
            )}
          </VStack>
        )}
      </Box>
    </MainLayout>
  );
}
