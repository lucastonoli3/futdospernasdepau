import React, { useEffect, useMemo, useState } from 'react';
import { Player, GlobalFinances } from '../types';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { CAIXA, CLUB, currentMonthRef, monthLabel, dueDateLabel } from '../brandConfig';
import { buildPixBRCode, qrImageUrl, formatPixKeyDisplay } from '../services/pixService';

interface CaixinhaProps {
  players: Player[];
  finances: GlobalFinances | null;
  currentUser: Player;
}

interface MensalidadeRow {
  player_id: string;
  month_ref: string;
  status: 'pago' | 'pendente' | 'em_analise';
  amount?: number;
  method?: string;
  receipt_url?: string;
  paid_at?: string;
}

interface CashflowRow {
  id: string;
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
  created_at: string;
}

const Caixinha: React.FC<CaixinhaProps> = ({ players, finances, currentUser }) => {
  const monthRef = currentMonthRef();
  const [pix, setPix] = useState({ key: CAIXA.pix.key, holderName: CAIXA.pix.holderName, amount: CAIXA.mensalidadeDefault });
  const [mensalidades, setMensalidades] = useState<MensalidadeRow[]>([]);
  const [cashflow, setCashflow] = useState<CashflowRow[]>([]);
  const [hasMensalidadeTable, setHasMensalidadeTable] = useState(true);
  const [copied, setCopied] = useState<'key' | 'brcode' | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadMensalidades();
    loadCashflow();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase.from('club_settings').select('*').eq('id', 1).maybeSingle();
      if (data) {
        setPix({
          key: data.pix_key || CAIXA.pix.key,
          holderName: data.pix_holder || CAIXA.pix.holderName,
          amount: data.mensalidade_amount || CAIXA.mensalidadeDefault,
        });
      }
    } catch (e) { /* usa config padrão */ }
  };

  const loadMensalidades = async () => {
    try {
      const { data, error } = await supabase.from('mensalidades').select('*').eq('month_ref', monthRef);
      if (error) { setHasMensalidadeTable(false); return; }
      setMensalidades((data as MensalidadeRow[]) || []);
    } catch (e) { setHasMensalidadeTable(false); }
  };

  const loadCashflow = async () => {
    try {
      const { data } = await supabase.from('cashflow').select('*').order('created_at', { ascending: false }).limit(40);
      if (data) setCashflow(data as CashflowRow[]);
    } catch (e) { /* tabela opcional */ }
  };

  // Status da mensalidade por jogador (com fallback no players.is_paid)
  const statusOf = (p: Player): 'pago' | 'pendente' | 'em_analise' => {
    const row = mensalidades.find(m => m.player_id === p.id);
    if (row) return row.status;
    if (!hasMensalidadeTable) return p.isPaid ? 'pago' : 'pendente';
    return 'pendente';
  };

  const myStatus = statusOf(currentUser);
  const valor = pix.amount || CAIXA.mensalidadeDefault;

  const brcode = useMemo(
    () => buildPixBRCode({ key: pix.key, keyType: CAIXA.pix.keyType, name: pix.holderName, city: CLUB.city, amount: valor, txid: `BGFC${monthRef.replace('-', '')}` }),
    [pix.key, pix.holderName, valor, monthRef]
  );

  const pagos = players.filter(p => statusOf(p) === 'pago');
  const emAnalise = players.filter(p => statusOf(p) === 'em_analise');
  const pendentes = players.filter(p => statusOf(p) === 'pendente');

  const entradas = cashflow.filter(c => c.type === 'entrada').reduce((a, c) => a + Number(c.amount), 0);
  const saidas = cashflow.filter(c => c.type === 'saida').reduce((a, c) => a + Number(c.amount), 0);
  const saldo = finances?.total_balance ?? (entradas - saidas);

  const copy = async (text: string, which: 'key' | 'brcode') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  const sendReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1000, useWebWorker: true });
      const reader = new FileReader();
      reader.readAsDataURL(compressed);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const { error } = await supabase.from('mensalidades').upsert({
          player_id: currentUser.id,
          month_ref: monthRef,
          status: 'em_analise',
          amount: valor,
          method: 'pix',
          receipt_url: base64,
        }, { onConflict: 'player_id,month_ref' });
        if (error) {
          alert('Não consegui enviar o comprovante. A diretoria precisa rodar a migração da tabela "mensalidades" no Supabase.');
        } else {
          alert('Comprovante enviado! A diretoria vai conferir e dar baixa. Valeu!');
          loadMensalidades();
        }
        setUploading(false);
      };
    } catch (err) {
      setUploading(false);
      alert('Erro ao processar a imagem. Tenta outra.');
    }
  };

  const StatusPill = ({ status }: { status: 'pago' | 'pendente' | 'em_analise' }) => {
    const map = {
      pago: { t: 'EM DIA', c: 'text-pitch-400 bg-pitch-900/30 border-pitch-600/40' },
      em_analise: { t: 'EM ANÁLISE', c: 'text-gold bg-gold-900/20 border-gold/40' },
      pendente: { t: 'PENDENTE', c: 'text-red-400 bg-red-900/20 border-red-600/40' },
    }[status];
    return <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${map.c}`}>{map.t}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-4 space-y-6 pb-24 animate-slide-up">
      {/* HEADER */}
      <div className="mb-2">
        <h2 className="section-title text-3xl md:text-4xl text-white">Tesouraria do <span className="text-gold">Balaio</span></h2>
        <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.4em] mt-1">Mensalidade • {monthLabel(monthRef)}</p>
      </div>

      {/* MINHA MENSALIDADE */}
      <div className="glass-panel border-gold/20 rounded-3xl p-6 brand-gradient">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={currentUser.photo} className="w-14 h-14 rounded-2xl object-cover border-2 border-gold/40" alt={currentUser.nickname} />
            <div>
              <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Minha mensalidade</p>
              <p className="font-oswald text-2xl font-black uppercase italic text-white leading-none">{currentUser.nickname}</p>
              <div className="mt-2"><StatusPill status={myStatus} /></div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Valor</p>
            <p className="font-oswald text-4xl font-black text-gold tracking-tighter">R$ {valor.toFixed(2)}</p>
            <p className="text-[11px] text-neutral-400 font-mono uppercase mt-1">Vence {dueDateLabel()} (1º domingo do mês)</p>
          </div>
        </div>

        {myStatus !== 'pago' && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => copy(brcode, 'brcode')}
              className="py-3 rounded-xl bg-gold text-black font-oswald font-black uppercase italic text-sm hover:bg-gold-600 transition-all active:scale-95"
            >
              {copied === 'brcode' ? '✓ PIX copiado!' : 'Copiar PIX p/ pagar'}
            </button>
            <label className={`py-3 rounded-xl border border-gold/40 text-gold font-oswald font-black uppercase italic text-sm text-center cursor-pointer transition-all hover:bg-gold hover:text-black ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? 'Enviando...' : '📎 Enviar comprovante'}
              <input type="file" accept="image/*" className="hidden" onChange={sendReceipt} />
            </label>
          </div>
        )}
        {myStatus === 'pago' && (
          <p className="mt-4 text-pitch-400 font-oswald uppercase italic text-sm">✓ Tá tudo certo, mensalidade do mês paga. Valeu, sócio!</p>
        )}
        {myStatus === 'em_analise' && (
          <p className="mt-2 text-gold/80 font-mono text-[10px] uppercase tracking-widest">Comprovante recebido — aguardando a diretoria dar baixa.</p>
        )}
      </div>

      {/* PIX DA DIRETORIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel border-white/5 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-oswald font-black uppercase tracking-widest text-white flex items-center gap-2"><span>🔑</span> Chave PIX do clube</h3>
          <div className="bg-black/50 border border-neutral-800 rounded-xl p-4">
            <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">{CAIXA.pix.keyType} • {pix.holderName}</p>
            <p className="text-gold font-mono text-xl break-all font-bold">{formatPixKeyDisplay(pix.key, CAIXA.pix.keyType)}</p>
          </div>
          <button
            onClick={() => copy(pix.key, 'key')}
            className="w-full py-3 rounded-xl border border-gold/40 text-gold font-oswald font-black uppercase italic text-xs hover:bg-gold hover:text-black transition-all"
          >
            {copied === 'key' ? '✓ Chave copiada!' : 'Copiar chave PIX'}
          </button>
          <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest text-center">
            Depois de pagar, mande o comprovante pra diretoria dar baixa.
          </p>
        </div>

        <div className="glass-panel border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-oswald font-black uppercase tracking-widest text-white flex items-center gap-2 mb-4"><span>📲</span> QR Code PIX</h3>
          <div className="bg-white p-2 rounded-2xl">
            <img src={qrImageUrl(brcode, 220)} width={220} height={220} alt="QR Code PIX" className="rounded-lg" />
          </div>
          <p className="text-gold font-oswald font-black text-lg mt-3">R$ {valor.toFixed(2)}</p>
          <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Aponte a câmera do seu banco</p>
        </div>
      </div>

      {/* SALDO + RESUMO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Saldo do clube" value={`R$ ${Number(saldo).toFixed(2)}`} accent="text-pitch-400" icon="🏦" />
        <SummaryCard label="Em dia este mês" value={`${pagos.length}/${players.length}`} accent="text-gold" icon="✅" />
        <SummaryCard label="Entradas" value={`R$ ${entradas.toFixed(2)}`} accent="text-pitch-400" icon="⬆️" />
        <SummaryCard label="Saídas" value={`R$ ${saidas.toFixed(2)}`} accent="text-red-400" icon="⬇️" />
      </div>

      {/* SITUAÇÃO DA GALERA */}
      <section className="glass-panel border-white/5 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-oswald font-black uppercase tracking-widest text-white flex items-center gap-2"><span>👥</span> Situação da galera — {monthLabel(monthRef)}</h3>
          <div className="flex items-center gap-3 text-[9px] font-black uppercase">
            <span className="text-pitch-400">{pagos.length} em dia</span>
            {emAnalise.length > 0 && <span className="text-gold">{emAnalise.length} em análise</span>}
            <span className="text-red-400">{pendentes.length} pendente</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...pendentes, ...emAnalise, ...pagos].map(p => {
            const st = statusOf(p);
            return (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${st === 'pago' ? 'bg-black/30 border-white/5' : st === 'em_analise' ? 'bg-gold-900/10 border-gold/20' : 'bg-red-950/10 border-red-900/20'}`}>
                <div className="flex items-center gap-3">
                  <img src={p.photo} className={`w-9 h-9 rounded-lg object-cover ${st === 'pago' ? '' : 'grayscale'}`} alt={p.nickname} />
                  <span className="font-oswald uppercase italic text-sm text-neutral-200">{p.nickname}</span>
                </div>
                <StatusPill status={st} />
              </div>
            );
          })}
        </div>
        {!hasMensalidadeTable && (
          <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest text-center pt-2">
            * Exibindo status simplificado. Rode a migração das tabelas de tesouraria para controle por mês completo.
          </p>
        )}
      </section>

      {/* EXTRATO */}
      <section className="glass-panel border-white/5 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-oswald font-black uppercase tracking-widest text-white flex items-center gap-2"><span>📒</span> Extrato do caixa</h3>
        {cashflow.length > 0 ? (
          <div className="space-y-2">
            {cashflow.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{c.type === 'entrada' ? '⬆️' : '⬇️'}</span>
                  <div>
                    <p className="text-sm font-oswald uppercase italic text-neutral-200">{c.description}</p>
                    <p className="text-[9px] text-neutral-600 font-mono uppercase">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <span className={`font-oswald font-black ${c.type === 'entrada' ? 'text-pitch-400' : 'text-red-400'}`}>
                  {c.type === 'entrada' ? '+' : '-'} R$ {Number(c.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest text-center py-6">
            Nenhuma movimentação registrada ainda. A diretoria lança entradas e saídas pelo painel.
          </p>
        )}
      </section>

      {/* METAS */}
      {finances?.goals && finances.goals.length > 0 && (
        <section className="glass-panel border-white/5 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-oswald font-black uppercase tracking-widest text-white flex items-center gap-2"><span>🎯</span> Metas do clube</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finances.goals.map(goal => (
              <div key={goal.id} className="bg-black/40 border border-neutral-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-oswald uppercase text-white">{goal.title}</span>
                  <span className="text-[10px] font-mono text-neutral-500">{Math.round((goal.current / goal.target) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-mono uppercase">
                  <span className="text-neutral-600">Faltam R$ {(goal.target - goal.current).toFixed(2)}</span>
                  <span className="text-white">Meta R$ {goal.target}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) => (
  <div className="glass-panel border-white/5 rounded-2xl p-4 relative overflow-hidden">
    <span className="absolute -right-1 -top-1 text-3xl opacity-10">{icon}</span>
    <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">{label}</p>
    <p className={`font-oswald font-black text-xl tracking-tighter ${accent}`}>{value}</p>
  </div>
);

export default Caixinha;
