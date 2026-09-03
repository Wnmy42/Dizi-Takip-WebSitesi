'use client';

import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateShowStatus } from '@/lib/supabase/actions';
import { getStatusLabel } from '@/lib/utils';
import type { ShowStatus } from '@/lib/supabase/types';

const STATUSES: ShowStatus[] = ['watching', 'plan_to_watch', 'completed', 'dropped'];

export function StatusSelector({ showId, currentStatus }: { showId: string; currentStatus: ShowStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={currentStatus}
      disabled={isPending}
      onValueChange={(v) => {
        startTransition(async () => {
          await updateShowStatus(showId, v as ShowStatus);
        });
      }}
    >
      <SelectTrigger className="h-7 text-xs w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">{getStatusLabel(s)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
