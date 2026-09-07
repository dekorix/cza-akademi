'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const token = new URLSearchParams(location.search).get('token') || '';
    const r = await fetch('/api/educator-auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset', token, newPassword: password }),
    });
    const result = await r.json().catch(() => ({}));
    setMessage(r.ok ? 'Parolan hazır. Eğitimci panelinden giriş yapabilirsin.' :
      result.error === 'rate_limited' ? 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.' :
      'Bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı iste.');
    setSaving(false);
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Eğitimci parolası oluştur</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="En az 8 karakter"
        />
        <Button className="w-full" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Parolayı kaydet'}</Button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </main>
  );
}
