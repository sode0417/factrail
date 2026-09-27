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

import { Box, Button, Flex, Spinner, Text, VStack } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { MemoCard, MemoGroupHeader, MemoImportButton } from '@/components/memos';
import { fetchMemoGroups } from '@/lib/memos';
import type { MemoGroup } from '@/types/memo';

/**
 * 読み込みの状態。
 *
 * 🔴 `empty`（まだ 1 件も無い）と `error`（読み込めなかった）を必ず別に持つ。
 *    ひとつにまとめると、F2A に繋がっていないことに気づけないまま
 *    「まだありません」と表示し続ける。
 */
type Status = 'loading' | 'ready' | 'error';

export default function MemosPage() {
  const [groups, setGroups] = useState<MemoGroup[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  // ⚠️ 同期の setState を持たないこと —— effect から呼ぶため
  //    (react-hooks/set-state-in-effect)。状態の切り替えは await の後だけ。
  const loadMemos = useCallback(async () => {
    try {
      const result = await fetchMemoGroups();
      setGroups(result);
      setStatus('ready');
    } catch (error) {
      console.error('読書メモの取得に失敗しました', error);
      setGroups([]);
      setStatus('error');
    }
  }, []);

  // ⭐ 読み込み表示の切り替え（同期の setState）は「取得を始めた出来事」の側に置く。
  //    effect の本体では待つだけ —— facts ページと同じ形
  //    (react-hooks/set-state-in-effect)。
  useEffect(() => {
    void (async () => {
      await loadMemos();
    })();
  }, [loadMemos]);

  const retry = useCallback(() => {
    setStatus('loading');
    void loadMemos();
  }, [loadMemos]);

  // 素材はあるがハイライトが 0 件、という状態も「まだありません」に寄せる
  const totalMemos = groups.reduce((sum, group) => sum + group.memos.length, 0);

  return (
    <MainLayout title="メモ" subtitle="素材ごとにハイライトとメモをまとめる">
      <Box px={{ base: 3, md: 6, lg: 8 }} py={6} maxW="1600px" mx="auto" w="100%">
        {/* ⭐ 取り込みは一覧の読み込みとは独立。読み込めていなくても取り込めるよう、
            状態に関係なく常に出す */}
        <MemoImportButton onImported={retry} />

        {status === 'loading' && (
          <Flex justify="center" py={10}>
            <Spinner size="xl" color="brand.500" />
          </Flex>
        )}

        {status === 'error' && (
          <Flex
            direction="column"
            align="center"
            gap={3}
            py={10}
            data-testid="memos-error"
          >
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

        {status === 'ready' && totalMemos === 0 && (
          <Flex
            direction="column"
            align="center"
            gap={2}
            py={10}
            data-testid="memos-empty"
          >
            <Text color="text.default" fontWeight={600}>
              読書メモはまだ 1 件もありません
            </Text>
            <Text color="text.muted" fontSize="sm" textAlign="center">
              F2A への問い合わせは成功しています。取り込みが済むとここに並びます。
            </Text>
          </Flex>
        )}

        {status === 'ready' && totalMemos > 0 && (
          <VStack spacing={6} align="stretch" data-testid="memos-list">
            {groups.map((group) => (
              <Box key={group.id} data-testid="memo-group">
                <MemoGroupHeader group={group} />
                <VStack spacing={2} align="stretch">
                  {group.memos.map((memo) => (
                    <MemoCard key={memo.id} memo={memo} />
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </MainLayout>
  );
}
