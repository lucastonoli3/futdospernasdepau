import React, { useEffect, useState } from 'react';

/**
 * Controle de Acessibilidade (opt-in) pensado para sócios 30–60 anos.
 * - Aumentar o tamanho de TUDO (usa zoom, então até as letrinhas crescem).
 * - Alto contraste (clareia textos apagados).
 * Salva no próprio aparelho (localStorage) e aplica na hora.
 */

const SCALES = [
  { label: 'Normal', value: '1' },
  { label: 'Grande', value: '1.15' },
  { label: 'Maior', value: '1.3' },
];

export const applyA11y = (scale: string, contrast: boolean) => {
  const el = document.documentElement;
  (el.style as any).zoom = scale === '1' ? '' : scale;
  el.classList.toggle('a11y-contrast', contrast);
};

const AccessibilityControl: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState<string>(() => localStorage.getItem('bgfc_a11y_scale') || '1');
  const [contrast, setContrast] = useState<boolean>(() => localStorage.getItem('bgfc_a11y_contrast') === '1');

  useEffect(() => {
    applyA11y(scale, contrast);
    localStorage.setItem('bgfc_a11y_scale', scale);
    localStorage.setItem('bgfc_a11y_contrast', contrast ? '1' : '0');
  }, [scale, contrast]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 rounded-xl border border-gold/30 text-gold font-bold transition-all hover:bg-gold hover:text-black ${compact ? 'px-3 py-2 text-sm' : 'w-full justify-center px-4 py-3'}`}
        aria-label="Acessibilidade: tamanho da letra e contraste"
        title="Tamanho da letra e contraste"
      >
        <span className="text-base">🔠</span>
        {!compact && <span className="text-sm font-black uppercase tracking-wide">Acessibilidade</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[140]" onClick={() => setOpen(false)} />
          <div className={`absolute z-[150] w-64 rounded-2xl border border-gold/30 bg-neutral-900 p-4 shadow-2xl ${compact ? 'right-0 top-12' : 'bottom-14 left-0'}`}>
            <p className="text-sm font-black text-white uppercase mb-3">Tamanho da letra</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SCALES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  className={`py-3 rounded-xl text-sm font-black transition-all ${scale === s.value ? 'bg-gold text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setContrast(c => !c)}
              className={`w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-black transition-all ${contrast ? 'bg-gold text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >
              <span>Alto contraste</span>
              <span>{contrast ? '✓ Ligado' : 'Desligado'}</span>
            </button>

            <p className="text-[11px] text-neutral-500 mt-3 leading-snug">
              Deixa o app maior e mais fácil de ler. Fica salvo no seu celular.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AccessibilityControl;
