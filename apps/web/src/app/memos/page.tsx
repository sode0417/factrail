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
//   ⛔ 同じ理由で、検索も**ブラウザの中だけ**で行う（サーバに検索語を渡して
//      サーバ側で絞ると、絞った結果を HTML に載せることになる）。
//
//   確かめ方: `curl` でこのページを取り、HTML にメモの本文が 1 文字も出ていない
//   ことを見る。ブラウザで見て「ログイン画面が出た」は検証にならない（ブラウザは
//   クッキーを持っているかもしれない）。

import { Box, Button, Flex, Icon, Spinner, Text, VStack } from '@chakra-ui/react';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout';
import {
  MemoCard,
  MemoImportButton,
  MemoMatchNote,
  MemoSearchBox,
  MemoSourceHeader,
} from '@/components/memos';
import { fetchMemoDetail, fetchMemoPage } from '@/lib/memos';
import { searchMemos } from '@/lib/memo-search';
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

  // 検索語と、検索中に手で閉じた素材
  const [query, setQuery] = useState('');
  const [searchCollapsedIds, setSearchCollapsedIds] = useState<Set<string>>(new Set());

  // ⚠️ 同じ素材の詳細を二重に取りに行かないための見張り。
  //    ⭐ state ではなく ref —— 取得中であることは画面に出さないので再描画が要らない。
  const inFlightIds = useRef<Set<string>>(new Set());

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

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
    inFlightIds.current = new Set();
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

  /**
   * 素材 1 つの詳細（ハイライト）を取る。
   * 🔴 「0 件だった」と「取れなかった」を混ぜない —— 失敗は `detailErrorIds` に入れる。
   */
  const loadDetail = useCallback(async (id: string) => {
    if (inFlightIds.current.has(id)) return;
    inFlightIds.current.add(id);
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
      setDetailErrorIds((prev) => new Set(prev).add(id));
    } finally {
      inFlightIds.current.delete(id);
    }
  }, []);

  /**
   * 本文・メモを探すには詳細が要るので、まだ無い分をまとめて取りに行く。
   *
   * ⭐ 検索語が入った時に初めて取る。⛔ 一覧の描画時には取らない
   *    （開いてもいない素材の数だけ叩くことになる）。
   * ⚠️ 素材が増えるとこの「全素材ぶん叩く」形が重くなる。その時は F2A 側に
   *    検索の口を足して置き換えること（📏 2026-09-28 時点は素材 5 件・ハイライト 29 件）。
   */
  useEffect(() => {
    if (!isSearching) return;
    const missing = sources.filter(
      (source) =>
        source.highlightCount > 0 && !detailMap[source.id] && !detailErrorIds.has(source.id),
    );
    if (missing.length === 0) return;
    void Promise.all(missing.map((source) => loadDetail(source.id)));
  }, [isSearching, sources, detailMap, detailErrorIds, loadDetail]);

  const toggleExpand = useCallback(
    async (id: string) => {
      // 検索中は「一致した素材を開いた状態」が既定。手で閉じられるようにしておく
      if (isSearching) {
        setSearchCollapsedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }

      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

      if (detailMap[id]) return;
      await loadDetail(id);
    },
    [isSearching, detailMap, loadDetail],
  );

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    // ⭐ 検索語を変えたら、前の検索で閉じた覚えは捨てる
    setSearchCollapsedIds(new Set());
  }, []);

  const search = useMemo(
    () =>
      searchMemos({
        sources,
        detailMap,
        failedIds: detailErrorIds,
        query: trimmedQuery,
      }),
    [sources, detailMap, detailErrorIds, trimmedQuery],
  );

  /** 🔴 これが 0 になるまで「一致 0 件」と言ってはいけない（まだ探し終わっていない）。 */
  const pendingSourceCount = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.highlightCount > 0 && !detailMap[source.id] && !detailErrorIds.has(source.id),
      ).length,
    [sources, detailMap, detailErrorIds],
  );

  const searchFinished = isSearching && pendingSourceCount === 0;

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
          <>
            {/* 🔴 絞り込みはブラウザの中だけ（F2A に検索の口は無い）。
                ⛔ サーバ側で絞らない —— 絞った結果を HTML に載せることになる */}
            <MemoSearchBox
              value={query}
              onChange={changeQuery}
              isSearching={isSearching}
              pendingSourceCount={pendingSourceCount}
              matchedSourceCount={search.matches.length}
              matchedMemoCount={search.matchedMemoCount}
              loadedSourceCount={sources.length}
              unsearched={search.unsearched}
              hasMore={hasMore}
            />

            {/* 🔴 「探し終わって 0 件」だけをこう出す。⛔ 読み込み中に出さない */}
            {searchFinished && search.matches.length === 0 && (
              <Flex
                direction="column"
                align="center"
                gap={2}
                py={8}
                data-testid="memos-search-empty"
              >
                <Text color="text.default" fontWeight={600}>
                  {/* 🔴 探せなかった素材があるなら「無い」と言い切らない */}
                  「{trimmedQuery}」に一致する読書メモは
                  {search.unsearched.length > 0 ? '、探せた範囲にはありません' : 'ありません'}
                </Text>
                <Text color="text.muted" fontSize="sm" textAlign="center">
                  探したのは、題名・リンク・ハイライトの本文・自分のメモです。
                  <br />
                  著者やタグは対象に入っていません。
                </Text>
              </Flex>
            )}

            <VStack spacing={3} align="stretch" data-testid="memos-list">
              {/* 🔴 並べ替えをしない。F2A が返した順のまま描く
                  （F2A 側が MAX(highlighted_at) → created_at → 件数 → id で解決済み）
                  ⛔ 検索中も一致件数で並べ替えない */}
              {search.matches.map((match) => {
                const source = match.source;
                const isExpanded = isSearching
                  ? !searchCollapsedIds.has(source.id)
                  : expandedIds.has(source.id);
                const detail = detailMap[source.id];
                const failed = detailErrorIds.has(source.id);
                // ⭐ 本文・メモが当たった素材は、当たったハイライトだけ出す
                //    （⛔ 何件隠したかは MemoMatchNote が書く）
                const onlyMatched = isSearching && match.matchedMemos.length > 0;
                const memosToShow = onlyMatched ? match.matchedMemos : (detail?.memos ?? []);

                return (
                  <Box key={source.id}>
                    <MemoSourceHeader
                      source={source}
                      isExpanded={isExpanded}
                      onToggle={() => void toggleExpand(source.id)}
                    />

                    {isSearching && <MemoMatchNote match={match} />}

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
                        ) : !detail && source.highlightCount > 0 ? (
                          // ⭐ これから取りに行く（⛔ ハイライト 0 件の素材で回し続けない。
                          //    0 件の素材は検索のために取りに行かないため detail が来ない）
                          <Flex justify="center" py={4}>
                            <Spinner size="sm" color="brand.500" />
                          </Flex>
                        ) : memosToShow.length === 0 ? (
                          <Text fontSize="12px" color="text.muted" px={4} py={3}>
                            この素材にハイライトは入っていません。
                          </Text>
                        ) : (
                          <VStack spacing={2} align="stretch">
                            {/* 🔴 返っていないハイライトがあることを黙って隠さない */}
                            {detail?.truncated && (
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
                            {memosToShow.map((memo) => (
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
          </>
        )}
      </Box>
    </MainLayout>
  );
}
