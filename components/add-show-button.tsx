'use client';

import { useState, useTransition } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addShow } from '@/lib/supabase/actions';
import { getStatusLabel } from '@/lib/utils';
import type { ShowStatus } from '@/lib/supabase/types';
import type { TMDBShow } from '@/lib/tmdb/types';

const STATUSES: ShowStatus[] = ['watching', 'plan_to_watch', 'completed', 'dropped'];

interface AddShowButtonProps {
  show: TMDBShow;
  isInLibrary?: boolean;
}

export function AddShowButton({ show, isInLibrary = false }: AddShowButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ShowStatus>('plan_to_watch');
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(isInLibrary);

  function handleAdd() {
    startTransition(async () => {
      const result = await addShow({
        tmdb_show_id: show.id,
        title: show.name,
        poster_path: show.poster_path,
        total_episodes: show.number_of_episodes ?? 0,
        status,
      });
      if (!result.error) {
        setDone(true);
        setOpen(false);
      }
    });
  }

  if (done) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Check className="h-4 w-4 mr-1" />
        Listede
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Listeye Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{show.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Durum</label>
            <Select value={status} onValueChange={(v) => setStatus(v as ShowStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ekle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
