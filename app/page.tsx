'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  core,
  coreStudent,
  friendlyCoreError,
  type CoreStudent,
} from '@/lib/core-client';
import { StudentDashboard } from '@/components/student-dashboard';
import { WorkCenter } from '@/components/work-center';
import type { StudentDashboardData } from '@/lib/student-dashboard-contract';

async function fetchDashboard() {
  const response = await fetch('/api/core/dashboard', { cache: 'no-store' });
  const data = (await response.json()) as {
    ok?: boolean;
    dashboard?: StudentDashboardData;
    error?: string;
  };
  if (!response.ok || data.ok !== true || !data.dashboard) {
    throw new Error(data.error || 'student_dashboard_unavailable');
  }
  return data.dashboard;
}

export function StudentPortal({ area }: { area: 'main' | 'work' }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [student, setStudent] = useState<CoreStudent | null>(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  async function refreshDashboard() {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      setDashboard(await fetchDashboard());
    } catch {
      setDashboard(null);
      setDashboardError(
        'Çalışma verilerin şu anda yüklenemedi. Bağlantını kontrol edip yeniden dene.',
      );
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    async function restoreStudent() {
      try {
        const ticket = new URLSearchParams(window.location.search).get('handoff');
        if (ticket) {
          window.location.replace(
            `/api/legacy-handoff?ticket=${encodeURIComponent(ticket)}`,
          );
          return;
        }
        if (
          new URLSearchParams(window.location.search).get('handoffError')
        ) {
          throw new Error('handoff_unavailable');
        }
        const restored = await fetchDashboard();
        setDashboard(restored);
        setStudent({
          name: restored.profile.name,
          username: restored.profile.username,
        });
      } catch (error) {
        setStudent(null);
        if (
          error instanceof Error &&
          error.message !== 'session_required' &&
          error.message !== 'invalid_session'
        ) {
          setLoginError(
            'Güvenli panel geçişi tamamlanamadı. Yeniden giriş yap.',
          );
        }
      } finally {
        setAuthLoading(false);
      }
    }
    void restoreStudent();
  }, []);

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const data = await core('login', {
        username: username.trim(),
        pin: pin.trim(),
      });
      setStudent(coreStudent(data));
      setPin('');
      await refreshDashboard();
    } catch (error) {
      setLoginError(friendlyCoreError(error));
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    try {
      await core('logout');
      setStudent(null);
      setDashboard(null);
      setPin('');
      setLoginError('');
    } catch (error) {
      setLoginError(
        `${friendlyCoreError(error)} Güvenli çıkışı yeniden deneyin.`,
      );
    }
  }

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="inline-flex items-center gap-3 text-sm font-semibold text-muted-foreground">
          <Loader2 className="animate-spin" /> Öğrenci oturumu açılıyor…
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <main className="min-h-screen bg-background px-5 py-12">
        <form
          onSubmit={login}
          aria-busy={loginBusy}
          className="mx-auto mt-[8vh] max-w-md rounded-3xl border border-border bg-white p-8 shadow-lg"
        >
          <p className="eyebrow text-primary">ÇELİK ZİHİN AKADEMİSİ</p>
          <h1 className="mt-3 text-3xl font-semibold">Öğrenci girişi</h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            Çalışma merkezine girmek için kullanıcı adı ve PIN bilgilerini yaz.
          </p>
          <label className="mt-7 block font-semibold" htmlFor="home-username">
            Kullanıcı adı
          </label>
          <Input
            id="home-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 h-12"
            disabled={loginBusy}
            required
          />
          <label className="mt-4 block font-semibold" htmlFor="home-pin">
            PIN
          </label>
          <Input
            id="home-pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
            className="mt-2 h-12"
            disabled={loginBusy}
            required
          />
          {loginError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-4 font-semibold text-red-800"
            >
              {loginError}
            </p>
          ) : null}
          {loginBusy ? (
            <output className="mt-4 block text-center font-medium text-primary">
              Bilgilerin güvenli biçimde doğrulanıyor…
            </output>
          ) : null}
          <Button
            type="submit"
            className="mt-6 h-12 w-full text-base"
            disabled={loginBusy || !username.trim() || !pin.trim()}
          >
            {loginBusy ? (
              <>
                <Loader2 className="animate-spin" /> Giriş hazırlanıyor…
              </>
            ) : (
              'Giriş yap'
            )}
          </Button>
        </form>
      </main>
    );
  }

  if (area === 'work') {
    return (
      <WorkCenter
        dashboard={dashboard}
        loading={dashboardLoading}
        error={dashboardError || loginError}
        onLogout={logout}
      />
    );
  }

  return (
    <StudentDashboard
      dashboard={dashboard}
      loading={dashboardLoading}
      error={dashboardError || loginError}
      onLogout={logout}
    />
  );
}

export default function Home() {
  return <StudentPortal area="main" />;
}
