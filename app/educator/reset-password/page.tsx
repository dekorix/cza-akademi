'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { educatorAuthRequest, educatorAuthError } from '@/lib/educator-auth-client';
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
      await educatorAuthRequest({ action: 'reset', token, newPassword: password });
      setPassword('');
      setMessage('Parolan hazır. Eğitimci panelinden giriş yapabilirsin.');
    } catch (error) {
      setMessage(educatorAuthError(error));
    } finally { setSaving(false); }
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Eğitimci parolası oluştur</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          aria-label="Yeni parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="En az 8 karakter"
        />
        <Button className="w-full" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Parolayı kaydet'}</Button>
      </form>
      {message && <p role="status" className="mt-4">{message}</p>}
      <a href="/educator?tab=reports" className="mt-5 inline-block font-semibold text-primary">Eğitimci girişine dön</a>
    </main>
  );
}
