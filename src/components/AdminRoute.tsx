import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock } from 'lucide-react';
import { Button } from './UI';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const [isServerAdmin, setIsServerAdmin] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function checkServerAdmin() {
      if (authLoading) return;

      // Unauthenticated or offline guest accounts can never be server admins
      if (!user || !user.isFirebase) {
        if (!isCancelled) {
          setIsServerAdmin(false);
          setVerifying(false);
        }
        return;
      }

      try {
        const token = await getIdToken();
        if (!token) {
          if (!isCancelled) {
            setIsServerAdmin(false);
            setVerifying(false);
          }
          return;
        }

        const res = await fetch('/api/admin/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setIsServerAdmin(Boolean(data.isAdmin));
          }
        } else {
          if (!isCancelled) {
            setIsServerAdmin(false);
          }
        }
      } catch {
        if (!isCancelled) {
          setIsServerAdmin(false);
        }
      } finally {
        if (!isCancelled) {
          setVerifying(false);
        }
      }
    }

    checkServerAdmin();

    return () => {
      isCancelled = true;
    };
  }, [user, authLoading, getIdToken]);

  if (authLoading || verifying) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isServerAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-white uppercase tracking-wider mb-2">
          Akses Administrator Ditolak (403)
        </h1>
        <p className="text-zinc-400 text-sm max-w-md mb-6 leading-relaxed">
          Area ini dibatasi khusus untuk akun administrator server ZiGame. Token otentikasi kamu tidak memiliki klaim administrator server-authoritative yang valid.
        </p>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Kembali ke Beranda
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
