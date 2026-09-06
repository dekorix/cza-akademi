'use client';

import { applyBeadAction, placeName, type BeadAction, type BeadMove } from '@/lib/soroban-curriculum';

type Props = { value: number; digits: number; onChange?: (value: number) => void; onMove?: (move: BeadMove) => void; reveal?: boolean; teaching?: boolean; highlight?: BeadAction };
export function Soroban({ value, digits, onChange, onMove, reveal = false, teaching = false, highlight }: Props) {
  const columns = String(value).padStart(digits, '0').split('').map(Number);
  const editable = Boolean(onChange || onMove);
  function change(index: number, deck: BeadAction['deck'], bead: number) {
    try { navigator.vibrate?.(10); } catch { /* Dokunma titreşimi her cihazda desteklenmeyebilir. */ }
    const action = {place:10 ** (digits-index-1),deck,bead};
    const after = applyBeadAction(value,digits,action);
    onMove?.({...action,before:value,after});
    onChange?.(after);
  }
  const highlighted = (index: number, deck: BeadAction['deck'], bead: number) => highlight?.place === 10 ** (digits-index-1) && highlight.deck === deck && highlight.bead === bead;
  return <div className={`mx-auto w-fit ${teaching ? 'lesson-abacus' : ''}`}>
    {teaching && <div className="mb-4 flex justify-center gap-4 px-[25px]">{columns.map((_,i)=><span key={i} className="w-12 text-center text-[11px] font-semibold text-muted-foreground">{placeName(10 ** (digits-i-1))}</span>)}</div>}
    <fieldset className="abacus" aria-label={editable ? 'Sayı oluşturmak için soroban boncukları' : 'Soroban okuma sorusu'}>
      {columns.map((digit, index) => <div key={index} className="abacus-rod" style={{ cursor: 'default' }}>
        <button type="button" disabled={!editable} aria-label={editable ? `${placeName(10 ** (digits-index-1))} basamağı: üst boncuğu değiştir${highlighted(index,'upper',0) ? ', rehberin önerdiği hareket' : ''}` : `Üst boncuk ${digit >= 5 ? 'çubuğa yakın' : 'çubuktan uzak'}`} aria-pressed={digit >= 5} className={`abacus-bead upper ${digit >= 5 ? 'engaged' : ''} ${highlighted(index,'upper',0) ? 'hint-bead' : ''}`} onClick={() => change(index,'upper',0)} />
        {[0,1,2,3].map(bead => <button type="button" key={bead} disabled={!editable} aria-label={editable ? `${placeName(10 ** (digits-index-1))} basamağı: ${bead+1}. alt boncuk${highlighted(index,'lower',bead) ? ', rehberin önerdiği hareket' : ''}` : `${bead+1}. alt boncuk ${bead < digit%5 ? 'çubuğa yakın' : 'çubuktan uzak'}`} aria-pressed={bead < digit%5} className={`abacus-bead lower ${bead < digit%5 ? 'engaged' : ''} ${highlighted(index,'lower',bead) ? 'hint-bead' : ''}`} onClick={() => change(index,'lower',bead)} />)}
      </div>)}
    </fieldset>
    {reveal && <p className="mt-4 text-center text-sm text-muted-foreground">Gösterdiğin sayı: <strong className="text-foreground">{value}</strong></p>}
  </div>;
}
