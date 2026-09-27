'use client';

import { Box, Button, Flex, Icon, Text, VStack } from '@chakra-ui/react';
import { FiAlertTriangle, FiCheckCircle, FiUpload } from 'react-icons/fi';
import { useCallback, useRef, useState } from 'react';
import { importKindleMemos } from '@/lib/memos';
import type { MemoImportError, MemoImportSummary } from '@/types/memo';

/**
 * 取り込みの結果に出す数字。
 *
 * 🔴 **来た項目だけ出す。** F2A 側で項目名が変わる予定があり
 *    （`books_existing` → `books_updated` + `books_unchanged` 等・2026-09-27 に
 *    F2A 担当から連絡）、⛔ 無い項目を 0 と書くと嘘になるため。
 */
const COUNT_LABELS: { key: keyof MemoImportSummary; label: string }[] = [
  { key: 'books_in_file', label: 'ファイルに入っていた素材' },
  { key: 'books_created', label: '新しく入った素材' },
  { key: 'books_existing', label: '既にあった素材' },
  { key: 'books_updated', label: '直した素材' },
  { key: 'books_unchanged', label: '変わらなかった素材' },
  { key: 'books_skipped', label: '取り込めなかった素材' },
  { key: 'books_with_notice', label: '欠落の但し書きが付いた素材' },
  { key: 'highlights_in_file', label: 'ファイルに入っていたハイライト' },
  { key: 'highlights_inserted', label: '新しく入ったハイライト' },
  { key: 'highlights_duplicate', label: '既にあったハイライト' },
  { key: 'highlights_updated', label: '直したハイライト' },
  { key: 'highlights_unchanged', label: '変わらなかったハイライト' },
];

/** 失敗の理由ごとの文言。⛔ ひとまとめの「失敗しました」にしない。 */
function failureMessage(error: MemoImportError): { title: string; body: string } {
  switch (error.kind) {
    case 'not-deployed':
      return {
        title: 'F2A に取り込みの口がまだありません（404）',
        body: 'こちらの作りの誤りではありません。F2A は取り込みの口をコードには持っていますが、本番で動いているものが古いままです。F2A の再ビルドと再起動が済むと使えるようになります。',
      };
    case 'unauthorized':
      return {
        title: 'F2A にログインできていません',
        body: 'F2A のログインが切れている可能性があります。F2A を一度開き直してから、もう一度お試しください。',
      };
    case 'too-large':
      return {
        title: 'ファイルが大きすぎます',
        body: '取り込めるのは 16MB までです。',
      };
    case 'invalid-json':
      return {
        title: 'JSON として読めませんでした',
        body: 'kindle-exporter が出した JSON ファイルを選んでください。ファイルは送っていません。',
      };
    case 'rejected':
      return {
        title: 'F2A が中身を受け付けませんでした',
        body: 'ファイルの形が想定と違うようです。kindle-exporter が出したものかご確認ください。',
      };
    default:
      return {
        title: '取り込めませんでした',
        body: 'F2A に繋がらなかったか、想定していない失敗が起きました。',
      };
  }
}

function ResultPanel({ summary }: { summary: MemoImportSummary }) {
  const counts = COUNT_LABELS.filter(
    ({ key }) => typeof summary[key] === 'number',
  );
  const skipped = (summary.books ?? []).filter((b) => b.result === 'skipped');
  const unknown = summary.unknown_fields ?? [];

  return (
    <Box
      mt={3}
      px={4}
      py={3}
      bg="accent.soft"
      border="1px solid"
      borderColor="accent.default"
      borderRadius="md"
      data-testid="memo-import-result"
    >
      <Flex align="center" gap={2} mb={2}>
        <Icon as={FiCheckCircle} color="accent.strong" boxSize="15px" />
        <Text fontSize="sm" fontWeight={600} color="accent.strong">
          取り込みました
        </Text>
      </Flex>

      {counts.length > 0 ? (
        <VStack align="stretch" spacing="2px">
          {counts.map(({ key, label }) => (
            <Flex key={key} justify="space-between" gap={4} fontSize="12px">
              <Text color="text.muted">{label}</Text>
              <Text color="text.default" fontWeight={600}>
                {String(summary[key])} 件
              </Text>
            </Flex>
          ))}
        </VStack>
      ) : (
        // ⚠️ 数字が1つも返らなかった＝「0件だった」ではない。黙って成功に見せない
        <Text fontSize="12px" color="text.muted">
          F2A が件数を返しませんでした。取り込まれたかどうかは確かめられていません。
        </Text>
      )}

      {/* 🔴 「黙って欠ける」ものは必ず出す */}
      {skipped.length > 0 && (
        <Box mt={3} pt={2} borderTop="1px solid" borderColor="border.muted">
          <Text fontSize="12px" fontWeight={600} color="#8A4A18" mb="2px">
            取り込めなかった素材（{skipped.length} 件）
          </Text>
          <VStack align="stretch" spacing="2px">
            {skipped.map((book, i) => (
              <Text key={`${book.asin ?? book.title}-${i}`} fontSize="11.5px" color="#8A4A18">
                {book.title}
                {book.skipped_reason ? ` — ${book.skipped_reason}` : ' — 理由が返っていません'}
              </Text>
            ))}
          </VStack>
        </Box>
      )}

      {unknown.length > 0 && (
        <Box mt={3} pt={2} borderTop="1px solid" borderColor="border.muted">
          <Text fontSize="12px" fontWeight={600} color="#8A4A18" mb="2px">
            F2A が知らない項目が {unknown.length} 件ありました
          </Text>
          <Text fontSize="11.5px" color="#8A4A18">
            この分の情報は取り込まれていません: {unknown.join(' / ')}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * JSON から取り込むボタン。**予備の経路**。
 *
 * 🔴 **これは本筋ではない。** 本人のご依頼は「押すと Kindle の収集そのものが走る」形で
 *    （2026-09-27 本人回答: 自動 1 日 1 回 ＋ 手動の「今すぐ取り込む」の両方）、
 *    そちらは F2A に収集を起動する口ができてから足す。⛔ 混同しないよう、
 *    画面でも「予備」と判る表示にしてある。
 *
 * ⭐ それでも残す理由: **収集が壊れたときに、手元の JSON から入れ直せる道**になるため
 *    （⚠️ Amazon のログインが切れると収集は失敗する）。自動収集は壊れていても
 *    誰も押していないので気づけない —— factrail の `browser` ソースで実際に
 *    7 日間 落ち続けた型なので、逃げ道は残しておく。
 */
export function MemoImportButton({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<MemoImportSummary | null>(null);
  const [error, setError] = useState<MemoImportError | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setSummary(null);
      setError(null);
      try {
        const result = await importKindleMemos(file);
        setSummary(result);
        onImported?.();
      } catch (e) {
        console.error('読書メモの取り込みに失敗しました', e);
        const known = e as Partial<MemoImportError>;
        setError({
          kind: known?.kind ?? 'unknown',
          detail: known?.detail ?? null,
        });
      } finally {
        setBusy(false);
      }
    },
    [onImported],
  );

  return (
    <Box mb={4}>
      <Flex align="center" gap={3} wrap="wrap">
        <Button
          size="sm"
          leftIcon={<Icon as={FiUpload} />}
          onClick={() => inputRef.current?.click()}
          isLoading={busy}
          loadingText="取り込み中"
          variant="ghost"
          color="text.muted"
          fontWeight={500}
        >
          JSON から取り込む（予備）
        </Button>
        <Text fontSize="11.5px" color="text.muted">
          収集がうまくいかないときの逃げ道です。kindle-exporter が出した JSON を選んでください。
          同じものを 2 回入れても増えません。
        </Text>
      </Flex>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        data-testid="memo-import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // 同じファイルを選び直せるよう、値を空に戻す
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      {summary && <ResultPanel summary={summary} />}

      {error && (
        <Flex
          align="flex-start"
          gap={2}
          mt={3}
          px={4}
          py={3}
          bg="#FBEFE4"
          border="1px solid"
          borderColor="#E0965A"
          borderRadius="md"
          data-testid="memo-import-error"
        >
          <Icon as={FiAlertTriangle} color="#B4652A" boxSize="15px" mt="2px" flexShrink={0} />
          <Box minW={0}>
            <Text fontSize="sm" fontWeight={600} color="#8A4A18">
              {failureMessage(error).title}
            </Text>
            <Text fontSize="12px" color="#8A4A18" mt="2px">
              {failureMessage(error).body}
            </Text>
            {error.detail && (
              <Text fontSize="11.5px" color="#8A4A18" mt="4px" fontFamily="mono">
                F2A からの返答: {error.detail}
              </Text>
            )}
          </Box>
        </Flex>
      )}
    </Box>
  );
}
