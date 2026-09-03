'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setValue(newValue);
    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set('q', newValue);
    } else {
      params.delete('q');
    }
    startTransition(() => {
      router.replace(`/discover?${params.toString()}`);
    });
  }

  return (
    <div className="relative w-full max-w-xl">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Dizi ara..."
        value={value}
        onChange={handleChange}
        className={`pl-9 ${isPending ? 'opacity-70' : ''}`}
      />
    </div>
  );
}
