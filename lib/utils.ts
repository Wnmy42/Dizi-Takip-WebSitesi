import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  if (m === 0) return `${h}sa`;
  return `${h}sa ${m}dk`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    watching: 'İzliyorum',
    plan_to_watch: 'İzleyeceğim',
    completed: 'Tamamlandı',
    dropped: 'Bıraktım',
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    watching: 'bg-blue-500',
    plan_to_watch: 'bg-yellow-500',
    completed: 'bg-green-500',
    dropped: 'bg-red-500',
  };
  return colors[status] ?? 'bg-gray-500';
}
