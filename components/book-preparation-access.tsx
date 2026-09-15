'use client';

import { type SyntheticEvent, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

export function BookPreparationAccess() {
  const [ticket, setTicket] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  async function exchange(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const headers = new Headers({ 'content-type': 'application/json' });
      if (ticket.trim())
        headers.set('authorization', `Bearer ${ticket.trim()}`);
      const response = await fetch('/api/book-preparation/session', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'bootstrap' }),
      });
      if (!response.ok) throw new Error('book_preview_access_denied');
      setTicket('');
      window.location.replace('/book-preparation');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ee] px-4 py-10 text-[#23342f]">
      <section className="w-full max-w-lg rounded-3xl border border-[#d8ded8] bg-white p-7 shadow-lg sm:p-9">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#173f36] text-[#dff2b5]">
          <ShieldCheck size={28} />
        </span>
        <p className="mt-6 font-black uppercase tracking-[.14em] text-[#337965]">
          İzole eğitimci laboratuvarı
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Kitap Hazırlama erişimi
        </h1>
        <p className="mt-3 leading-7 text-[#61716b]">
          Merkezî eğitimci oturumunuz doğrulanır. İzole testlerde yalnız yetkili
          kişiye verilen kısa ömürlü, tek kullanımlık erişim kodu
          kullanılabilir.
        </p>

        <form onSubmit={exchange} className="mt-7 space-y-5">
          <div>
            <label htmlFor="book-preview-exchange-token" className="font-bold">
              İzole erişim kodu
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#bdc9c3] px-4 focus-within:border-[#337965] focus-within:ring-3 focus-within:ring-[#bce2d3]">
              <KeyRound size={19} className="shrink-0 text-[#337965]" />
              <input
                id="book-preview-exchange-token"
                type="password"
                autoComplete="one-time-code"
                value={ticket}
                onChange={(event) => setTicket(event.target.value)}
                className="min-h-12 min-w-0 flex-1 bg-transparent outline-none"
              />
            </div>
            <p className="mt-2 text-sm text-[#61716b]">
              Merkezî oturumunuz varsa bu alanı boş bırakın.
            </p>
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="min-h-13 w-full rounded-xl bg-[#173f36] px-5 font-black text-white disabled:opacity-60"
          >
            {status === 'sending'
              ? 'Kimlik doğrulanıyor…'
              : 'Eğitimci önizlemesini aç'}
          </button>
          <output
            aria-live="polite"
            className="block min-h-6 font-semibold text-[#9b493f]"
          >
            {status === 'error'
              ? 'Erişim doğrulanamadı. Kod geçersiz, kullanılmış veya süresi dolmuş olabilir.'
              : ''}
          </output>
        </form>
      </section>
    </main>
  );
}
