'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { DatePreset, getPresetRange, toISOStart, toISOEnd } from '@/lib/dateUtils';

export function useDateFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const preset = (searchParams.get('preset') ?? '') as DatePreset | '';

  const isActive = from !== '' || to !== '';

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const setDateRange = useCallback(
    (newFrom: string, newTo: string) => {
      updateParams({ from: newFrom, to: newTo, preset: '' });
    },
    [updateParams],
  );

  const applyPreset = useCallback(
    (p: DatePreset) => {
      const range = getPresetRange(p);
      updateParams({ from: range.from, to: range.to, preset: p });
    },
    [updateParams],
  );

  const clearFilter = useCallback(() => {
    updateParams({ from: '', to: '', preset: '' });
  }, [updateParams]);

  const apiParams = useMemo(() => {
    const params: { from?: string; to?: string } = {};
    if (from) params.from = toISOStart(from);
    if (to) params.to = toISOEnd(to);
    return params;
  }, [from, to]);

  return {
    from,
    to,
    preset,
    isActive,
    setDateRange,
    applyPreset,
    clearFilter,
    apiParams,
  };
}
