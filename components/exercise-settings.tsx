'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { defaultConfig, modeLabels, type ExerciseConfig, type ExerciseMode, type Operation } from '@/lib/exercise-engine';

export function ExerciseSettings({ config, onChange, disabled = false }: { config: ExerciseConfig; onChange: (config: ExerciseConfig) => void; disabled?: boolean }) {
  const update = (values: Partial<ExerciseConfig>) => onChange({ ...config, ...values });
  const mental = config.mode === 'flash' || config.mode === 'audio';
  return <fieldset disabled={disabled} className="space-y-5 disabled:opacity-50">
    <div><label htmlFor="exercise-mode" className="mb-2 block text-xs font-semibold">Çalışma türü</label>
      <Select value={config.mode} onValueChange={v => v && update({ mode: v as ExerciseMode })} disabled={disabled}>
        <SelectTrigger id="exercise-mode" className="h-10 w-full"><SelectValue>{modeLabels[config.mode]}</SelectValue></SelectTrigger>
        <SelectContent>{Object.entries(modeLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div><label htmlFor="digits" className="mb-2 block text-xs font-semibold">Basamak</label><Select value={String(config.digits)} onValueChange={v => v && update({ digits: Number(v) })} disabled={disabled}><SelectTrigger id="digits" className="h-10 w-full"><SelectValue>{config.digits} basamak</SelectValue></SelectTrigger><SelectContent>{[1,2,3].map(v => <SelectItem key={v} value={String(v)}>{v} basamak</SelectItem>)}</SelectContent></Select></div>
      <div><label htmlFor="rounds" className="mb-2 block text-xs font-semibold">Soru sayısı</label><Select value={String(config.rounds)} onValueChange={v => v && update({ rounds: Number(v) })} disabled={disabled}><SelectTrigger id="rounds" className="h-10 w-full"><SelectValue>{config.rounds} soru</SelectValue></SelectTrigger><SelectContent>{[5,10,15,20].map(v => <SelectItem key={v} value={String(v)}>{v} soru</SelectItem>)}</SelectContent></Select></div>
    </div>
    {mental && <>
      <div><label htmlFor="operation" className="mb-2 block text-xs font-semibold">İşlem türü</label><Select value={config.operation} onValueChange={v => v && update({ operation: v as Operation })} disabled={disabled}><SelectTrigger id="operation" className="h-10 w-full"><SelectValue>{config.operation === 'add' ? 'Toplama' : config.operation === 'subtract' ? 'Çıkarma' : 'Toplama ve çıkarma'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="add">Toplama</SelectItem><SelectItem value="subtract">Çıkarma</SelectItem><SelectItem value="mixed">Toplama ve çıkarma</SelectItem></SelectContent></Select></div>
      <div><div className="mb-4 flex justify-between text-xs"><label id="terms-label" className="font-semibold">Bir sorudaki terim</label><span>{config.terms} sayı</span></div><Slider aria-labelledby="terms-label" value={[config.terms]} min={2} max={10} step={1} disabled={disabled} onValueChange={v => update({ terms: Number(Array.isArray(v) ? v[0] : v) })} /></div>
      <div className="border-t border-border pt-4"><div className="flex items-center justify-between"><label htmlFor="manual-mode" className="text-xs font-semibold">Adım adım ilerle</label><Switch id="manual-mode" checked={config.interval === 0} disabled={disabled} onCheckedChange={v => update({ interval: v ? 0 : 1.5 })} /></div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Süre baskısı olmadan, her sayıyı sen ilerlet.</p></div>
      {config.interval > 0 && <div><div className="mb-4 flex justify-between text-xs"><label id="interval-label" className="font-semibold">{config.mode === 'audio' ? 'Sesler arası bekleme' : 'Sayı gösterim süresi'}</label><span>{config.interval.toFixed(1)} sn</span></div><Slider aria-labelledby="interval-label" value={[config.interval]} min={.8} max={5} step={.1} disabled={disabled} onValueChange={v => update({ interval: Number(Array.isArray(v) ? v[0] : v) })} /></div>}
    </>}
    <details className="border-t border-border pt-4"><summary className="cursor-pointer text-xs font-semibold">Gelişmiş · rakam havuzu</summary><p className="mb-3 mt-3 text-[11px] leading-5 text-muted-foreground">Tek basamaklı çalışmalarda kullanılacak rakamlar. Çok basamaklı çalışmalarda tüm sayılar kullanılır.</p><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8,9].map(n => <Button type="button" key={n} variant={config.pool.includes(n) ? 'default' : 'outline'} disabled={disabled || config.digits > 1} aria-pressed={config.pool.includes(n)} onClick={() => update({ pool: config.pool.includes(n) ? config.pool.filter(v=>v!==n) : [...config.pool,n] })}>{n}</Button>)}</div></details>
    <Button type="button" variant="ghost" className="w-full text-xs text-muted-foreground" disabled={disabled} onClick={() => onChange({...defaultConfig, mode: config.mode})}>Ayarları sıfırla</Button>
  </fieldset>;
}
