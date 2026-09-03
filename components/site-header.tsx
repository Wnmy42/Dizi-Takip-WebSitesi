import Link from 'next/link';
import { Tv } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/supabase/actions';
import { Button } from '@/components/ui/button';

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/discover" className="flex items-center gap-2 font-bold text-lg">
          <Tv className="h-5 w-5 text-primary" />
          BingeTrack
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/discover"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Keşfet
          </Link>
          {user ? (
            <>
              <Link
                href="/library"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Kütüphanem
              </Link>
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  Çıkış
                </Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Giriş Yap</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
