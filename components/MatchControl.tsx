import React, { useState } from 'react';
import { Player } from '../types';
import { aiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface MatchControlProps {
  players: Player[];
  currentUser: Player;
}

const MatchControl: React.FC<MatchControlProps> = ({ players, currentUser }) => {
  const [teams, setTeams] = useState<{ A: string[], B: string[], C: string[] } | null>(null);
  const [aiComment, setAiComment] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [score, setScore] = useState({ A: 0, B: 0 });
  const [gameEvents, setGameEvents] = useState<{ type: string, player: string, time: string }[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);

  React.useEffect(() => {
    fetchSessionPresences();
    const channel = supabase
      .channel('session_presences')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, payload => {
        if (payload.new.players_present) {
          setConfirmedIds(payload.new.players_present);
        }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchSessionPresences = async () => {
    const { data } = await supabase.from('sessions').select('players_present').eq('id', 1).single();
    if (data?.players_present) setConfirmedIds(data.players_present);
  };

  const mainListIds = confirmedIds.slice(0, 15);
  const waitListIds = confirmedIds.slice(15);

  const handleConfirm = async (id: string) => {
    if (id !== currentUser.id) return;

    let newConfirmed;
    if (confirmedIds.includes(id)) {
      newConfirmed = confirmedIds.filter(i => i !== id);
    } else {
      newConfirmed = [...confirmedIds, id];
    }

    setConfirmedIds(newConfirmed);
    await supabase.from('sessions').update({ players_present: newConfirmed }).eq('id', 1);
  };

  const drawTeams = async () => {
    if (mainListIds.length < 9) {
      alert("Poucos viciados confirmados. Cadê o resto do bueiro?");
      return;
    }

    setIsGenerating(true);

    const presentPlayers = mainListIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => (b.moralScore || 0) - (a.moralScore || 0));

    const teamA: string[] = [];
    const teamB: string[] = [];
    const teamC: string[] = [];

    presentPlayers.forEach((p, index) => {
      const cycle = Math.floor(index / 3);
      const pos = index % 3;
      const isEvenCycle = cycle % 2 === 0;

      if (isEvenCycle) {
        if (pos === 0) teamA.push(p.nickname);
        else if (pos === 1) teamB.push(p.nickname);
        else teamC.push(p.nickname);
      } else {
        if (pos === 0) teamC.push(p.nickname);
        else if (pos === 1) teamB.push(p.nickname);
        else teamA.push(p.nickname);
      }
    });

    const newTeams = { A: teamA, B: teamB, C: teamC };
    setTeams(newTeams);

    try {
      const comment = await aiService.generateTeamDrawComment(newTeams.A, newTeams.B, newTeams.C);
      setAiComment(comment || "Sorteio feito. Vai dar merda.");
    } catch (e) {
      setAiComment("A IA foi pro bueiro e não quer voltar.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isConfirmed = confirmedIds.includes(currentUser.id);

  return (
    <div className="max-w-4xl mx-auto animate-slide-up pb-24 space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between px-2 gap-4">
        <div>
          <h2 className="section-title text-4xl md:text-5xl text-white uppercase italic">Campo de <span className="text-red-600">Batalha</span></h2>
          <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.4em] mt-1">Status da Lista: {mainListIds.length >= 15 ? 'LOTADA' : 'RECRUTANDO'}</p>
        </div>
        <div className="glass-panel border-neutral-800/50 p-4 rounded-2xl flex items-center gap-6">
          <div className="text-center">
            <p className="text-[9px] text-neutral-500 uppercase font-black mb-1">Confirmados</p>
            <p className="text-2xl font-oswald text-white font-black italic">{confirmedIds.length}</p>
          </div>
          <div className="h-8 w-[1px] bg-neutral-800"></div>
          <div className="text-center">
            <p className="text-[9px] text-neutral-500 uppercase font-black mb-1">Vagas</p>
            <p className="text-2xl font-oswald text-red-600 font-black italic">{Math.max(0, 15 - confirmedIds.length)}</p>
          </div>
        </div>
      </div>

      {/* WARNING BANNER */}
      <div className="mx-2 p-4 bg-red-900/10 border border-red-900/30 rounded-2xl flex items-start gap-4">
        <span className="text-2xl animate-pulse">⚠️</span>
        <div>
          <h4 className="font-oswald text-red-500 uppercase text-sm font-black italic tracking-widest">REGRA DE OURO DO BUEIRO</h4>
          <p className="text-[10px] text-neutral-400 font-mono leading-relaxed mt-1">
            CONFIRMOU E NÃO FOI? <span className="text-white font-bold">PAGA O JOGO IGUAL.</span> SEM CHORO, SEM IDEINHA. O ARREGO CUSTA CARO NO LEGADO.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-2">
        {/* PLAYER ACTION CARD */}
        <div className="lg:col-span-12 glass-panel border-white/5 p-6 rounded-[32px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="text-8xl font-black italic font-oswald text-white uppercase tracking-tighter">ELITE</span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img src={currentUser.photo} className={`w-20 h-20 object-cover rounded-2xl border-2 transition-all duration-500 ${isConfirmed ? 'border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'border-neutral-800 grayscale'}`} />
                {isConfirmed && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-md animate-bounce">PRONTO</div>}
              </div>
              <div>
                <p className="text-2xl font-oswald text-white uppercase italic font-black leading-tight">{currentUser.nickname}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${isConfirmed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-neutral-700'}`}></span>
                  <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">
                    {isConfirmed ? (mainListIds.includes(currentUser.id) ? 'TITULAR CONFIRMADO' : 'NA FILA DE ESPERA') : 'STATUS: DESCONECTADO'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleConfirm(currentUser.id)}
              className={`w-full md:w-auto px-12 py-5 font-oswald font-black uppercase italic tracking-[0.2em] rounded-2xl transition-all active:scale-95 shadow-xl ${isConfirmed
                ? 'bg-neutral-800 border border-neutral-700 text-red-500 hover:bg-neutral-900'
                : 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/20'}`}
            >
              {isConfirmed ? 'CANCELAR MISSÃO' : 'CONFIRMAR PRESENÇA'}
            </button>
          </div>
        </div>

        {/* LISTA TITULAR */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] italic">Bonde Titular <span className="text-red-600">/ 15</span></h3>
            <span className="text-[8px] font-mono text-neutral-500 uppercase">Prioridade por Chegada</span>
          </div>

          <div className="glass-panel border-white/5 rounded-[32px] overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
              {mainListIds.length > 0 ? mainListIds.map((id, index) => {
                const p = players.find(player => player.id === id);
                if (!p) return null;
                const isMe = p.id === currentUser.id;
                return (
                  <div key={id} className={`flex items-center justify-between p-4 mb-2 rounded-2xl transition-all border ${isMe ? 'bg-red-600/10 border-red-600 shadow-[inset_0_0_20px_rgba(220,38,38,0.05)]' : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-neutral-700 text-[10px] w-4 font-black">{(index + 1).toString().padStart(2, '0')}</span>
                      <img src={p.photo} className={`w-10 h-10 object-cover rounded-xl border ${isMe ? 'border-red-600' : 'border-neutral-800'}`} />
                      <div>
                        <p className={`font-oswald uppercase italic font-black text-sm ${isMe ? 'text-white' : 'text-neutral-300'}`}>{p.nickname}</p>
                        <p className="text-[8px] text-neutral-600 uppercase font-mono tracking-tighter">Moral: {p.moralScore}</p>
                      </div>
                    </div>
                    {isMe && <span className="text-[8px] bg-red-600 text-white font-black px-2 py-1 rounded italic">VOCÊ</span>}
                  </div>
                );
              }) : (
                <div className="py-20 text-center opacity-20 grayscale">
                  <span className="text-6xl block mb-4">Empty</span>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white">Campo Vazio. Cadê os viciados?</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LISTA DE ESPERA (XEPA) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em] italic">Xepa / <span className="text-neutral-700">Suplentes</span></h3>
          </div>

          <div className="glass-panel border-white/5 rounded-[32px] bg-black/40">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
              {waitListIds.length > 0 ? waitListIds.map((id, index) => {
                const p = players.find(player => player.id === id);
                if (!p) return null;
                const isMe = p.id === currentUser.id;
                return (
                  <div key={id} className="flex items-center justify-between p-4 mb-2 bg-black/40 border border-white/5 rounded-2xl opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-neutral-800 text-[10px] w-4">{index + 1}</span>
                      <img src={p.photo} className="w-8 h-8 object-cover rounded-lg border border-neutral-800" />
                      <p className="font-oswald uppercase italic font-black text-xs text-neutral-400">{p.nickname}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-20 text-center opacity-10">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white italic">Ninguém confirmou na suplência.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DRAW TEAMS SECTION */}
      {mainListIds.length >= 9 && !teams && (
        <div className="px-2 pt-8">
          <button
            onClick={drawTeams}
            disabled={isGenerating}
            className="w-full h-32 glass-panel border-red-600/30 hover:border-red-600 bg-red-600/5 transition-all active:scale-[0.98] group flex flex-col items-center justify-center rounded-[40px]"
          >
            {isGenerating ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-mono text-white uppercase tracking-[0.4em]">Sorteando Bonecos...</p>
              </div>
            ) : (
              <>
                <span className="text-3xl mb-2 group-hover:scale-125 transition-transform duration-500">🎲</span>
                <span className="text-2xl font-oswald text-white font-black uppercase italic tracking-widest">DEFINIR BONDES</span>
                <p className="text-[10px] text-red-600 font-black uppercase mt-1 tracking-widest">Algoritmo de Equilíbrio Vantablack</p>
              </>
            )}
          </button>
        </div>
      )}

      {/* TEAMS DISPLAY */}
      {teams && (
        <div className="space-y-8 animate-slide-up px-2 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['A', 'B', 'C'].map((label) => (
              <div key={label} className="glass-panel border-white/5 rounded-[32px] overflow-hidden group hover:border-red-600/20 transition-all">
                <div className="bg-red-600/10 p-4 border-b border-white/5 text-center">
                  <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1">Squad do Mal</p>
                  <h4 className="text-3xl font-oswald text-white font-black uppercase italic">Bonde {label}</h4>
                </div>
                <div className="p-4 space-y-2 bg-gradient-to-b from-black/0 to-black/40">
                  {teams[label as 'A' | 'B' | 'C'].map((name, i) => (
                    <div key={i} className="text-center py-3 bg-white/5 border border-white/5 rounded-xl text-sm font-oswald text-neutral-300 uppercase italic font-bold">
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {aiComment && (
            <div className="glass-panel border-red-600/20 p-8 rounded-[32px] relative overflow-hidden bg-red-600/[0.02]">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
              <span className="text-4xl text-red-600/20 absolute -top-2 left-6 italic font-serif">"</span>
              <p className="text-sm font-mono text-neutral-300 leading-relaxed italic relative z-10 px-4">
                {aiComment}
              </p>
              <div className="mt-4 flex items-center gap-2 px-4 justify-end">
                <span className="text-[9px] text-red-600 font-black uppercase tracking-widest">— IA DO BUEIRO</span>
              </div>
            </div>
          )}

          {/* LIVE MATCH CONTROLS */}
          {!isMatchActive ? (
            <button
              onClick={() => setIsMatchActive(true)}
              className="w-full py-6 bg-red-600 text-white font-oswald font-black text-2xl uppercase italic tracking-[0.2em] rounded-[32px] hover:bg-red-500 shadow-2xl shadow-red-900/20 transition-all active:scale-95 border-b-8 border-red-900"
            >
              INICIAR CONFRONTO
            </button>
          ) : (
            <div className="space-y-6 animate-slide-up">
              <div className="glass-panel border-red-600/30 p-10 rounded-[40px] text-center bg-black/60 relative overflow-hidden backdrop-blur-3xl shadow-[0_0_50px_rgba(220,38,38,0.1)]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 px-6 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-b-2xl italic">LIVE_MATCH</div>

                <div className="flex items-center justify-center gap-10 md:gap-20 mt-4">
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-neutral-500 font-oswald uppercase text-xs mb-4 tracking-widest font-black italic">Bonde A</span>
                    <span className="text-8xl md:text-9xl font-oswald font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{score.A}</span>
                    <button onClick={() => setScore(s => ({ ...s, A: s.A + 1 }))} className="mt-8 w-16 h-16 bg-white text-black font-black text-2xl rounded-2xl hover:bg-neutral-200 transition-all active:scale-90 shadow-xl shadow-white/5">+</button>
                  </div>

                  <div className="text-5xl font-oswald font-black text-red-600 italic opacity-50 select-none">VS</div>

                  <div className="flex flex-col items-center flex-1">
                    <span className="text-neutral-500 font-oswald uppercase text-xs mb-4 tracking-widest font-black italic">Bonde B</span>
                    <span className="text-8xl md:text-9xl font-oswald font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{score.B}</span>
                    <button onClick={() => setScore(s => ({ ...s, B: s.B + 1 }))} className="mt-8 w-16 h-16 bg-white text-black font-black text-2xl rounded-2xl hover:bg-neutral-200 transition-all active:scale-90 shadow-xl shadow-white/5">+</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['TROP-E-ÇO', 'F-U-R-A-D-A', 'GOL CONTRA', 'A-R-R-E-G-O'].map(evt => (
                  <button
                    key={evt}
                    onClick={() => setGameEvents(prev => [{ type: evt, player: 'Caneleiro', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...prev])}
                    className="p-5 bg-neutral-900/50 border border-neutral-800 hover:border-red-600 hover:text-white transition-all text-neutral-500 font-oswald font-black uppercase text-[10px] italic tracking-widest rounded-2xl"
                  >
                    {evt}
                  </button>
                ))}
              </div>

              {gameEvents.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {gameEvents.map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl animate-slide-up">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] text-neutral-600 font-mono italic">{e.time}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-red-500 uppercase font-black font-oswald italic tracking-widest">{e.type}</span>
                          <span className="text-neutral-700 font-mono text-[10px]">detected</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  if (confirm('ENCERRAR E GRAVAR VEXAMES?')) {
                    setIsMatchActive(false);
                    setTeams(null);
                    setScore({ A: 0, B: 0 });
                    setGameEvents([]);
                  }
                }}
                className="w-full py-5 text-neutral-600 font-mono text-[10px] uppercase tracking-[0.5em] hover:text-red-500 transition-all"
              >
                [ TERMINAR_PROCESSO_DE_HUMILHAÇÃO ]
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchControl;
