'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signIn } from '@/lib/supabase/actions';

type State = { error?: string } | undefined;

export default function LoginPage() {
  const [state, action, isPending] = useActionState<State, FormData>(signIn, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Link href="/discover" className="flex items-center gap-2 font-bold text-xl">
            <Tv className="h-6 w-6 text-primary" />
            BingeTrack
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Giriş Yap</CardTitle>
            <CardDescription>Dizi listeni görmek için giriş yap</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">E-posta</label>
                <Input id="email" name="email" type="email" required placeholder="ornek@mail.com" />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Şifre</label>
                <Input id="password" name="password" type="password" required placeholder="••••••••" />
              </div>
              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Hesabın yok mu?{' '}
              <Link href="/register" className="underline hover:text-foreground">Kayıt Ol</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
