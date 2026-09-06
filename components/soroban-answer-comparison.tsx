'use client';

import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Soroban } from '@/components/soroban';
import { compareSorobanStates } from '@/lib/soroban-comparison';

export function SorobanAnswerComparison({ studentValue, correctValue, digits, onRetry, onNext }: { studentValue: number; correctValue: number; digits: number; onRetry?: () => void; onNext?: () => void }) {
  const comparison = compareSorobanStates(studentValue, correctValue, digits);
  return <section className="w-full max-w-5xl text-center" aria-label="Soroban cevap karşılaştırması">
    <p className="eyebrow text-[#8e4f16]">BİRLİKTE KONTROL EDELİM</p>
    <h2 className="mt-2 text-2xl font-black">{comparison.isCorrect ? 'Dizilimler aynı.' : 'Bir fark var. Birlikte bakalım.'}</h2>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <article className="comparison-card comparison-student"><h3>● SENİN CEVABIN</h3><Soroban value={studentValue} digits={digits} highlightPlaces={comparison.differingPlaceValues}/><strong>{studentValue}</strong></article>
      <article className="comparison-card comparison-correct"><h3>★ DOĞRU CEVAP</h3><Soroban value={correctValue} digits={digits} highlightPlaces={comparison.differingPlaceValues}/><strong>{correctValue}</strong></article>
    </div>
    {!comparison.isCorrect && <output className="comparison-difference"><Search size={22}/><span><b className="block">FARKI GÖR</b><span>{comparison.message}</span></span></output>}
    {(onRetry || onNext) && <div className="mt-6 flex flex-wrap justify-center gap-3">{onRetry && <Button variant="outline" onClick={onRetry}><RotateCcw/> Bu soruyu tekrar dene</Button>}{onNext && <Button onClick={onNext}>Sonraki soru <ArrowRight/></Button>}</div>}
  </section>;
}
