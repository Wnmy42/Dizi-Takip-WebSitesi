'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MAX_SEARCH_QUERY_LENGTH, normalizeSearchQuery } from '@/lib/search/query';

export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setValue(newValue);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedValue = normalizeSearchQuery(newValue);
      if (normalizedValue) {
        params.set('q', normalizedValue);
      } else {
        params.delete('q');
      }
      params.delete('page');
      startTransition(() => {
        const queryString = params.toString();
        router.replace(queryString ? `/discover?${queryString}` : '/discover');
      });
    }, 300);
  }

  return (
    <div className="relative w-full max-w-xl">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Dizi ara..."
        value={value}
        onChange={handleChange}
        maxLength={MAX_SEARCH_QUERY_LENGTH}
        aria-label="Dizi ara"
        className={`pl-9 ${isPending ? 'opacity-70' : ''}`}
      />
    </div>
  );
}
