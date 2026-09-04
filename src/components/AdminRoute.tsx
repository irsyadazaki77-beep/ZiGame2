import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isFirebaseReady, auth } from '../services/firebase';
import { ShieldAlert, Lock } from 'lucide-react';
import { Button } from './UI';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        if (!isFirebaseReady() || !auth?.currentUser) {
          // Check if dev bypass token header exists or test mode
          const res = await fetch('/api/admin/verify');
          if (res.ok) {
            const data = await res.json();
            setIsAdmin(!!data.isAdmin);
          } else {
            setIsAdmin(false);
          }
          setLoading(false);
          return;
        }

        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/admin/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setIsAdmin(!!data.isAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAdminStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-white uppercase tracking-wider mb-2">
          Akses Administrator Ditolak (403)
        </h1>
        <p className="text-zinc-400 text-sm max-w-md mb-6 leading-relaxed">
          Area ini dibatasi khusus untuk akun administrator server ZiGame. Token otentikasi kamu tidak memiliki hak akses server-authoritative yang memadai.
        </p>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Kembali ke Beranda
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
