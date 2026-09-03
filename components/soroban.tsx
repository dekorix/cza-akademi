'use client';

type Props = { value: number; digits: number; onChange?: (value: number) => void; reveal?: boolean };
export function Soroban({ value, digits, onChange, reveal = false }: Props) {
  const columns = String(value).padStart(digits, '0').split('').map(Number);
  function change(index: number, digit: number) { onChange?.(Number(columns.map((v,i) => i === index ? digit : v).join(''))); }
  return <div className="mx-auto w-fit">
    <div className="abacus" role="group" aria-label={onChange ? 'Sayı oluşturmak için soroban boncukları' : 'Soroban okuma sorusu'}>
      {columns.map((digit, index) => <div key={index} className="abacus-rod" style={{ cursor: 'default' }}>
        <button type="button" disabled={!onChange} aria-label={onChange ? `${10 ** (digits-index-1)} basamağı: beşlik boncuğu değiştir` : `Üst boncuk ${digit >= 5 ? 'çubuğa yakın' : 'çubuktan uzak'}`} aria-pressed={digit >= 5} className={`abacus-bead upper ${digit >= 5 ? 'engaged' : ''}`} onClick={() => change(index, digit >= 5 ? digit-5 : digit+5)} />
        {[0,1,2,3].map(bead => <button type="button" key={bead} disabled={!onChange} aria-label={onChange ? `${10 ** (digits-index-1)} basamağı: ${bead+1}. birlik boncuğu` : `${bead+1}. alt boncuk ${bead < digit%5 ? 'çubuğa yakın' : 'çubuktan uzak'}`} aria-pressed={bead < digit%5} className={`abacus-bead lower ${bead < digit%5 ? 'engaged' : ''}`} onClick={() => change(index, (digit >= 5 ? 5 : 0) + (bead < digit%5 ? bead : bead+1))} />)}
      </div>)}
    </div>
    {reveal && <p className="mt-4 text-center text-sm text-muted-foreground">Gösterdiğin sayı: <strong className="text-foreground">{value}</strong></p>}
  </div>;
}
