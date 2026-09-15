'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vinext navigation intentionally uses native anchors. */
import { useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  FileText,
  Gauge,
  Hash,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BOOK_DIFFICULTY_LABELS,
  SYNTHETIC_BOOK_DRAFT,
  type BookBlockKind,
  type BookContentBlock,
  type BookDifficulty,
  type BookDraftInput,
  type ServerVerifiedBookContentSummary,
} from '@/lib/book-preparation-core';

type EditorBlock = BookContentBlock;
type SubmissionState = 'idle' | 'sending' | 'success' | 'error';

function editableSyntheticBlocks(): EditorBlock[] {
  return SYNTHETIC_BOOK_DRAFT.blocks.map((block) => ({ ...block }));
}

function newBlockId() {
  return `block-${globalThis.crypto.randomUUID()}`;
}

export function BookPreparationWorkspace() {
  const [title, setTitle] = useState(SYNTHETIC_BOOK_DRAFT.title);
  const [difficulty, setDifficulty] = useState<BookDifficulty>(
    SYNTHETIC_BOOK_DRAFT.difficulty,
  );
  const [minimumWpm, setMinimumWpm] = useState(
    SYNTHETIC_BOOK_DRAFT.targetWpm.minimum,
  );
  const [preferredWpm, setPreferredWpm] = useState(
    SYNTHETIC_BOOK_DRAFT.targetWpm.preferred,
  );
  const [maximumWpm, setMaximumWpm] = useState(
    SYNTHETIC_BOOK_DRAFT.targetWpm.maximum,
  );
  const [blocks, setBlocks] = useState<EditorBlock[]>(editableSyntheticBlocks);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');
  const [summary, setSummary] =
    useState<ServerVerifiedBookContentSummary | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  function updateBlock(
    clientBlockId: string,
    field: 'kind' | 'text',
    value: string,
  ) {
    setBlocks((current) =>
      current.map((block) =>
        block.clientBlockId === clientBlockId
          ? {
              ...block,
              [field]: field === 'kind' ? (value as BookBlockKind) : value,
            }
          : block,
      ),
    );
    setSummary(null);
    setSubmissionState('idle');
  }

  function addBlock() {
    setBlocks((current) => [
      ...current,
      { clientBlockId: newBlockId(), kind: 'paragraph', text: '' },
    ]);
    setSummary(null);
  }

  function removeBlock(clientBlockId: string) {
    setBlocks((current) =>
      current.length === 1
        ? current
        : current.filter((block) => block.clientBlockId !== clientBlockId),
    );
    setSummary(null);
  }

  async function loadTextFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type && file.type !== 'text/plain') {
      setSubmissionState('error');
      setMessage('Bu önizlemede yalnız düz metin (.txt) dosyası kabul edilir.');
      return;
    }
    if (file.size > 20_000) {
      setSubmissionState('error');
      setMessage('Metin dosyası 20 KB sınırını aşıyor.');
      return;
    }
    const paragraphs = (await file.text())
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map((text) => text.trim())
      .filter(Boolean);
    if (
      paragraphs.length < 1 ||
      paragraphs.length > 50 ||
      paragraphs.some((text) => text.length > 4_000)
    ) {
      setSubmissionState('error');
      setMessage(
        'Dosya, 1–50 blok ve blok başına 4.000 karakter sınırına uymuyor.',
      );
      return;
    }
    setBlocks(
      paragraphs.map((text, index) => ({
        clientBlockId: `block-upload-${index + 1}`,
        kind: 'paragraph',
        text,
      })),
    );
    setSummary(null);
    setSubmissionState('idle');
    setMessage(`${paragraphs.length} metin bloğu düzenleyiciye aktarıldı.`);
  }

  async function validatePreview() {
    if (submissionState === 'sending') return;
    setSubmissionState('sending');
    setMessage('İçerik sunucu kurallarına göre doğrulanıyor…');
    const draft: BookDraftInput = {
      title,
      language: 'tr-TR',
      difficulty,
      targetWpm: {
        minimum: minimumWpm,
        preferred: preferredWpm,
        maximum: maximumWpm,
      },
      blocks,
    };
    try {
      const response = await fetch('/api/book-preparation/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'preview', draft }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        summary?: ServerVerifiedBookContentSummary;
      };
      if (!response.ok || result.ok !== true || !result.summary) {
        throw new Error(result.error || 'book_preview_invalid');
      }
      setSummary(result.summary);
      setSubmissionState('success');
      setMessage('Sunucu doğrulaması tamamlandı. Hiçbir kayıt oluşturulmadı.');
    } catch (error) {
      setSummary(null);
      setSubmissionState('error');
      setMessage(
        error instanceof Error
          ? `Önizleme reddedildi: ${error.message}`
          : 'Önizleme doğrulanamadı.',
      );
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch('/api/book-preparation/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'logout' }),
      });
      if (!response.ok) throw new Error('book_preview_logout_failed');
      window.location.replace('/book-preparation');
    } catch {
      setLoggingOut(false);
      setMessage('Güvenli çıkış tamamlanamadı; oturum korunuyor.');
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ee] text-[#23342f]">
      <header className="border-b border-[#d8ded8] bg-[#173f36] px-4 text-white sm:px-7">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dff2b5] font-black text-[#173f36]">
              CZA
            </span>
            <div>
              <p className="font-bold">Kitap Hazırlama Stüdyosu</p>
              <p className="text-sm text-[#c9ddd6]">Eğitimci çalışma paneli</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href="/educator"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 font-semibold"
            >
              <ArrowLeft size={18} /> Panel
            </a>
            <button
              type="button"
              disabled={loggingOut}
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold text-[#173f36] disabled:opacity-60"
            >
              <LogOut size={18} />
              {loggingOut ? 'Çıkış yapılıyor…' : 'Güvenli çıkış'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 lg:py-10">
        <section className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="font-black uppercase tracking-[.14em] text-[#337965]">
              Faz 2 · İzole içerik laboratuvarı
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Metni düzenle, sunucuda doğrula, güvenle önizle.
            </h1>
            <p className="mt-3 leading-7 text-[#61716b]">
              Bu çalışma yalnız sentetik içerik kullanır. Öğrenci ataması,
              veritabanı kaydı ve canonical ledger bağlantısı kapalıdır.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e1f2e8] px-4 py-2 font-bold text-[#25644f]">
            <ShieldCheck size={19} /> Persistence kapalı
          </span>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <section className="space-y-5 rounded-3xl border border-[#d8ded8] bg-white p-5 shadow-sm sm:p-7">
            <div>
              <label htmlFor="book-title" className="font-bold">
                Kitap veya çalışma başlığı
              </label>
              <input
                id="book-title"
                value={title}
                maxLength={120}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSummary(null);
                }}
                className="mt-2 min-h-12 w-full rounded-xl border border-[#bdc9c3] px-4 outline-none focus:border-[#337965] focus:ring-3 focus:ring-[#bce2d3]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="font-bold">
                Zorluk derecesi
                <select
                  aria-label="Zorluk derecesi"
                  value={difficulty}
                  onChange={(event) => {
                    setDifficulty(event.target.value as BookDifficulty);
                    setSummary(null);
                  }}
                  className="mt-2 min-h-12 w-full rounded-xl border border-[#bdc9c3] bg-white px-4"
                >
                  {Object.entries(BOOK_DIFFICULTY_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="font-bold">
                TXT içeriği yükle
                <span className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#82aa9b] bg-[#f0f8f4] px-4 text-[#25644f]">
                  <Upload size={19} /> Dosya seç
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={loadTextFile}
                    className="sr-only"
                  />
                </span>
              </label>
            </div>

            <fieldset>
              <legend className="flex items-center gap-2 font-bold">
                <Gauge size={20} /> Hedef hız aralığı
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ['Minimum', minimumWpm, setMinimumWpm],
                  ['Hedef', preferredWpm, setPreferredWpm],
                  ['Maksimum', maximumWpm, setMaximumWpm],
                ].map(([label, value, setter]) => (
                  <label key={String(label)} className="font-semibold">
                    {String(label)} K/D
                    <input
                      type="number"
                      min={40}
                      max={800}
                      value={Number(value)}
                      onChange={(event) => {
                        (setter as (next: number) => void)(
                          Number(event.target.value),
                        );
                        setSummary(null);
                      }}
                      className="mt-2 min-h-12 w-full rounded-xl border border-[#bdc9c3] px-4"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e6e3] pt-5">
              <div>
                <h2 className="text-xl font-black">Metin blokları</h2>
                <p className="mt-1 text-[#6b7b74]">
                  HTML yerine doğrulanabilir başlık ve paragraf blokları.
                </p>
              </div>
              <button
                type="button"
                onClick={addBlock}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#edf5f1] px-4 font-bold text-[#286a55]"
              >
                <Plus size={18} /> Blok ekle
              </button>
            </div>

            <div className="space-y-4">
              {blocks.map((block, index) => (
                <article
                  key={block.clientBlockId}
                  className="rounded-2xl border border-[#d8ded8] bg-[#fbfcfa] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="font-bold">
                      Blok {index + 1}
                      <select
                        aria-label={`Blok ${index + 1} türü`}
                        value={block.kind}
                        onChange={(event) =>
                          updateBlock(
                            block.clientBlockId,
                            'kind',
                            event.target.value,
                          )
                        }
                        className="ml-3 min-h-10 rounded-lg border border-[#bdc9c3] bg-white px-3"
                      >
                        <option value="heading">Başlık</option>
                        <option value="paragraph">Paragraf</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={blocks.length === 1}
                      onClick={() => removeBlock(block.clientBlockId)}
                      aria-label={`Blok ${index + 1} sil`}
                      className="grid h-11 w-11 place-items-center rounded-xl text-[#9b493f] disabled:opacity-30"
                    >
                      <Trash2 size={19} />
                    </button>
                  </div>
                  <textarea
                    aria-label={`Blok ${index + 1} metni`}
                    value={block.text}
                    maxLength={4_000}
                    rows={block.kind === 'heading' ? 2 : 6}
                    onChange={(event) =>
                      updateBlock(
                        block.clientBlockId,
                        'text',
                        event.target.value,
                      )
                    }
                    className="mt-3 w-full resize-y rounded-xl border border-[#bdc9c3] bg-white p-4 leading-7 outline-none focus:border-[#337965] focus:ring-3 focus:ring-[#bce2d3]"
                  />
                </article>
              ))}
            </div>

            <button
              type="button"
              disabled={submissionState === 'sending'}
              onClick={validatePreview}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#173f36] px-6 font-black text-white disabled:opacity-60"
            >
              <ShieldCheck size={21} />
              {submissionState === 'sending'
                ? 'Sunucuda doğrulanıyor…'
                : 'Sunucuda doğrula ve önizle'}
            </button>
            <output
              aria-live="polite"
              className={`min-h-7 font-semibold ${submissionState === 'error' ? 'text-[#9b493f]' : 'text-[#286a55]'}`}
            >
              {message}
            </output>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6">
            <section className="rounded-3xl border border-[#d8ded8] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black uppercase tracking-[.12em] text-[#337965]">
                    Okuma önizlemesi
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {summary?.draft.title || title || 'Başlıksız çalışma'}
                  </h2>
                </div>
                <BookOpenText className="text-[#337965]" size={30} />
              </div>
              <div
                data-testid="book-rendered-preview"
                className="mt-6 space-y-4 rounded-2xl bg-[#fffdf7] p-5 leading-8"
              >
                {(summary?.draft.blocks || blocks).map((block) =>
                  block.kind === 'heading' ? (
                    <h3
                      key={block.clientBlockId}
                      className="text-xl font-black"
                    >
                      {block.text || 'Başlık bloğu'}
                    </h3>
                  ) : (
                    <p key={block.clientBlockId} className="text-[#4f5e58]">
                      {block.text || 'Paragraf metni'}
                    </p>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-[#203b52] p-6 text-white">
              <div className="flex items-center gap-2 font-bold text-[#dff2b5]">
                <FileText size={20} /> Sunucu doğrulamalı içerik özeti
              </div>
              {summary ? (
                <dl
                  className="mt-5 space-y-4"
                  data-testid="book-server-summary"
                >
                  <div>
                    <dt className="text-[#b9cbd8]">İçerik özeti</dt>
                    <dd className="mt-1 flex items-start gap-2 break-all font-mono">
                      <Hash className="mt-1 shrink-0" size={17} />
                      {summary.contentHash}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-[#b9cbd8]">Kelime</dt>
                      <dd className="mt-1 text-2xl font-black">
                        {summary.wordCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#b9cbd8]">Yaklaşık süre</dt>
                      <dd className="mt-1 text-2xl font-black">
                        {summary.approximateReadingSeconds} sn
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/10 p-3 text-[#e2f4ed]">
                    <CheckCircle2 size={19} /> serverValidated=true ·
                    persisted=false
                  </div>
                </dl>
              ) : (
                <p className="mt-4 leading-7 text-[#c7d6df]">
                  Hash, kelime sayısı ve süre yalnız sunucu doğrulamasından
                  sonra gösterilir.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
