'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  educatorAuthRequest,
  educatorAuthError,
} from '@/lib/educator-auth-client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    const token = new URLSearchParams(location.search).get('token') || '';
    try {
      const result = (await educatorAuthRequest({
        action: 'reset',
        token,
        newPassword: password,
      })) as { signedIn?: boolean; build?: string };
      setPassword('');
      window.history.replaceState(null, '', '/educator/reset-password');
      if (result.signedIn) {
        setMessage(
          'Parola kaydedildi. Güvenli eğitimci oturumu açıldı; panele yönlendiriliyorsun…',
        );
        window.location.replace('/educator?tab=students&auth=reset');
        return;
      }
      setMessage(
        'Parola kaydedildi. Eğitimci girişinden yeni parolanla oturum aç.',
      );
    } catch (error) {
      setMessage(educatorAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <p className="text-xs font-semibold text-primary">CZA Eğitimci Merkezi</p>
      <h1 className="mt-2 text-2xl font-semibold">Eğitimci parolası oluştur</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bağlantıdaki doğrulama koduyla parolanı belirle. Ardından yeni parolanla
        giriş yap.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input
          type="password"
          minLength={8}
          maxLength={128}
          required
          autoComplete="new-password"
          aria-label="Yeni parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="En az 8 karakter"
        />
        <p className="text-sm text-muted-foreground">En az 8 karakter kullan.</p>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Parolayı kaydet'}
        </Button>
      </form>
      {message && <output className="mt-4 block">{message}</output>}
      <a
        href="/educator?tab=reports"
        className="mt-5 inline-block font-semibold text-primary"
      >
        Eğitimci girişine dön
      </a>
    </main>
  );
}
