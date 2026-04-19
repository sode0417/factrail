'use client';

import { Box, Flex, Text } from '@chakra-ui/react';

interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <Flex
      align="center"
      gap={3}
      position="sticky"
      top="calc(var(--topbar-h) + 64px)"
      zIndex={8}
      bg="bg.canvas"
      py="10px"
      my="8px 10px"
      color="text.muted"
      fontSize="12px"
      fontWeight={600}
    >
      <Box flex={1} h="1px" bg="border.muted" />
      <Text
        as="b"
        fontFamily="heading"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.muted"
        px="14px"
        py="4px"
        borderRadius="pill"
        color="accent.strong"
        fontWeight={700}
        boxShadow="0 1px 2px rgba(74,60,20,0.04)"
      >
        {label}
      </Text>
      <Box flex={1} h="1px" bg="border.muted" />
    </Flex>
  );
}

export function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  const base = `${date.getMonth() + 1}月${date.getDate()}日 (${weekday})`;

  if (isSameDay(date, today)) return `今日 · ${base}`;
  if (isSameDay(date, yesterday)) return `昨日 · ${base}`;
  return base;
}

export function groupFactsByDate<T extends { occurredAt: string }>(
  facts: T[],
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[]; key: string }[] = [];
  for (const fact of facts) {
    const d = new Date(fact.occurredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.items.push(fact);
    else
      groups.push({
        key,
        label: formatDateLabel(fact.occurredAt),
        items: [fact],
      });
  }
  return groups.map(({ label, items }) => ({ label, items }));
}
