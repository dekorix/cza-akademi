'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveAssignedProgram } from '@/lib/assigned-session';
import type { ExerciseConfig } from '@/lib/exercise-engine';

type Assignment = {
  id: string;
  module_code: string;
  module_name?: string;
  name: string;
  settings: ExerciseConfig;
  status: string;
  launchPath: string | null;
};

export default function AssignmentLaunchPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function launch() {
      const recipeId =
        new URLSearchParams(window.location.search).get('recipe') || '';
      if (!recipeId) throw new Error('Atama bağlantısı eksik.');
      const detailsResponse = await fetch(
        `/api/core/assignments?recipeId=${encodeURIComponent(recipeId)}`,
        { cache: 'no-store' },
      );
      const details = (await detailsResponse.json()) as {
        ok?: boolean;
        assignment?: Assignment;
        error?: string;
      };
      if (!detailsResponse.ok || details.ok !== true || !details.assignment)
        throw new Error(details.error || 'Atama bulunamadı.');
      if (!details.assignment.launchPath)
        throw new Error('Bu çalışma motoru henüz etkin değil.');
      if (!saveAssignedProgram(recipeId, details.assignment.settings))
        throw new Error('Çalışma ayarları bu cihazda hazırlanamadı.');
      const launchResponse = await fetch('/api/core/assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      });
      const launched = (await launchResponse.json()) as {
        ok?: boolean;
        error?: string;
        launchPath?: string;
      };
      if (!launchResponse.ok || launched.ok !== true)
        throw new Error(launched.error || 'Çalışma başlatılamadı.');
      const launchPath = launched.launchPath || details.assignment.launchPath;
      if (!launchPath.startsWith('/'))
        throw new Error('Çalışma motoru güvenli biçimde çözümlenemedi.');
      if (!cancelled) window.location.replace(launchPath);
    }
    void launch().catch((error) => {
      if (!cancelled) {
        const message =
          error instanceof Error ? error.message : 'Atama açılamadı.';
        setError(
          message === 'assignment_completed'
            ? 'Bu çalışma tamamlandı. Sonucunu Çalışma Merkezinden görebilirsin.'
            : message === 'unsupported_assignment_module'
              ? 'Bu çalışma motoru henüz etkin değil.'
              : message,
        );
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-primary" />
          <p className="mt-4 font-semibold">
            Eğitimcinin çalışma reçetesi hazırlanıyor…
          </p>
        </div>
      </main>
    );
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md rounded-2xl border bg-white p-7 text-center">
        <h1 className="text-xl font-semibold">Çalışma açılamadı</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        <Button
          className="mt-5"
          onClick={() => window.location.replace('/work')}
        >
          Çalışma merkezine dön
        </Button>
      </div>
    </main>
  );
}
