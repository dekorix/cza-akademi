'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = new URLSearchParams(location.search).get('token') || '';
    const r = await fetch('/api/educator-auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset', token, newPassword: password }),
    });
    setMessage(
      r.ok
        ? 'Parolan hazır. Eğitimci panelinden giriş yapabilirsin.'
        : 'Bağlantı geçersiz veya süresi dolmuş.',
    );
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
        <Button className="w-full">Parolayı kaydet</Button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </main>
  );
}
