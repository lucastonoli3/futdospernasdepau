
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

  // Carregar presenças da sessão do Supabase (presumindo que currentSession chegue via props em uma versão futura ou via useEffect)
  // Mas como currentSession não está nas props agora, vou usar useEffect local para se inscrever
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

  // Split confirmed IDs into Main List (first 15) and Waitlist (rest)
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

    // Persistir no Supabase
    await supabase.from('sessions').update({ players_present: newConfirmed }).eq('id', 1);
  };

  const drawTeams = async () => {
    if (mainListIds.length < 9) {
      alert("Tem pouca gente, seus viciados. Cadê o resto?");
      return;
    }

    setIsGenerating(true);

    // Sortear os jogadores com base no moralScore para equilibrar
    const presentPlayers = mainListIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => (b.moralScore || 0) - (a.moralScore || 0));

    const teamA: string[] = [];
    const teamB: string[] = [];
    const teamC: string[] = [];

    // Distribuição "Serpente" para Equilíbrio Máximo
    // 1->A, 2->B, 3->C, 4->C, 5->B, 6->A, 7->A...
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

    const newTeams = {
      A: teamA,
      B: teamB,
      C: teamC
    };

    setTeams(newTeams);

    try {
      const comment = await aiService.generateTeamDrawComment(newTeams.A, newTeams.B, newTeams.C);
      setAiComment(comment || "Sorteio feito.");
    } catch (e) {
      setAiComment("A IA foi fumar uma pedra e não voltou.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-neutral-900 rounded-sm border border-neutral-800 shadow-2xl relative overflow-hidden">

      {/* WARNING BANNER */}
      <div className="bg-red-950/40 border border-red-800 p-4 rounded-sm mb-6 flex items-start space-x-3">
        <span className="text-2xl">💀</span>
        <div>
          <h4 className="font-oswald text-red-500 uppercase text-lg tracking-wide">PAPO RETO (SEM CURVA)</h4>
          <p className="text-sm text-neutral-300 font-mono">
            CONFIRMOU E NÃO FOI? <span className="underline decoration-wavy decoration-red-600 text-red-500 font-bold">VAI PAGAR A PORRA DO JOGO IGUAL</span>.
            NÃO PAGOU? VAI TOMAR PAU E TÁ EXPULSO DA PELADA. SEM IDEINHA.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-oswald text-white uppercase tracking-tighter">Próxima Batalha</h2>
          <p className="text-neutral-500 font-bold uppercase text-xs">SEGUNDA • 20:15 • QUADRA DO FERNANDO</p>
        </div>
        <div className="text-right">
          <div className={`px-4 py-2 font-black text-sm mb-1 uppercase tracking-widest ${mainListIds.length >= 15 ? 'bg-red-700 text-white' : 'bg-blue-900 text-blue-200 border border-blue-700'}`}>
            {mainListIds.length >= 15 ? 'LISTA FECHADA' : 'ABERTO'}
          </div>
          <p className="text-xs text-neutral-500 uppercase font-mono">{confirmedIds.length} Viciados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Main List */}
        <div>
          <h3 className="text-sm font-black text-green-500 uppercase mb-4 flex justify-between items-center border-b border-neutral-800 pb-2">
            <span>Os que vão jogar ({mainListIds.length}/15)</span>
            <span className="text-[10px] bg-green-950 text-green-500 px-2 py-1 uppercase">Bonde Titular</span>
          </h3>
          <div className="space-y-2">
            {mainListIds.map((id, index) => {
              const p = players.find(player => player.id === id);
              if (!p) return null;
              const isMe = p.id === currentUser.id;
              return (
                <div key={id} className={`flex items-center justify-between p-2 ${isMe ? 'bg-green-900/20 border border-green-800' : 'bg-neutral-800 border border-transparent'}`}>
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-neutral-600 w-4">{index + 1}.</span>
                    <img src={p.photo} className="w-6 h-6 rounded-none grayscale border border-neutral-700" />
                    <span className={`text-sm font-bold font-mono uppercase ${isMe ? 'text-white' : 'text-neutral-400'}`}>{p.nickname}</span>
                  </div>
                  {isMe && <button onClick={() => handleConfirm(p.id)} className="text-xs text-red-500 hover:text-red-400 font-bold uppercase">Arregar</button>}
                </div>
              )
            })}
            {mainListIds.length === 0 && <p className="text-neutral-700 text-xs italic text-center py-4 font-mono">Boca vazia. Cadê os drogados?</p>}
          </div>
        </div>

        {/* Wait List */}
        <div>
          <h3 className="text-sm font-black text-yellow-600 uppercase mb-4 flex justify-between items-center border-b border-neutral-800 pb-2">
            <span>Resto / Xepa</span>
            <span className="text-[10px] bg-yellow-950 text-yellow-600 px-2 py-1 uppercase">Suplentes</span>
          </h3>
          <div className="space-y-2">
            {waitListIds.map((id, index) => {
              const p = players.find(player => player.id === id);
              if (!p) return null;
              const isMe = p.id === currentUser.id;
              return (
                <div key={id} className={`flex items-center justify-between p-2 opacity-60 ${isMe ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-neutral-800'}`}>
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-neutral-600 w-4">{index + 1}.</span>
                    <img src={p.photo} className="w-6 h-6 rounded-none grayscale" />
                    <span className={`text-sm font-bold font-mono uppercase ${isMe ? 'text-white' : 'text-neutral-400'}`}>{p.nickname}</span>
                  </div>
                  {isMe && <button onClick={() => handleConfirm(p.id)} className="text-xs text-red-500 hover:text-red-400 font-bold uppercase">Arregar</button>}
                </div>
              )
            })}
            {waitListIds.length === 0 && <p className="text-neutral-700 text-xs italic text-center py-4 font-mono">Ninguém na xepa ainda.</p>}
          </div>
        </div>
      </div>

      {/* Action Area for Current User */}
      <div className="mb-8 p-4 bg-neutral-800 rounded-sm border border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={currentUser.photo} className="w-10 h-10 rounded-none border border-neutral-500" />
            <div>
              <p className="text-white font-bold text-sm uppercase font-mono">{currentUser.nickname}</p>
              <p className="text-xs text-neutral-400 uppercase font-bold">{confirmedIds.includes(currentUser.id) ? (mainListIds.includes(currentUser.id) ? '✅ Tá dentro' : '⏳ Na xepa') : '❌ Tá fora'}</p>
            </div>
          </div>
          <button
            onClick={() => handleConfirm(currentUser.id)}
            className={`px-6 py-3 font-oswald uppercase tracking-wider transition-all shadow-lg ${confirmedIds.includes(currentUser.id)
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : 'bg-green-700 hover:bg-green-600 text-white'
              }`}
          >
            {confirmedIds.includes(currentUser.id) ? 'Tô Fora (Arregar)' : 'Tô Dentro (Confirmar)'}
          </button>
        </div>
      </div>

      {mainListIds.length >= 9 && !teams && (
        <button
          onClick={drawTeams}
          className="w-full bg-indigo-900 hover:bg-indigo-800 py-4 font-oswald text-xl uppercase tracking-widest transition-transform active:scale-95 flex items-center justify-center space-x-2 border border-indigo-700 text-indigo-100"
        >
          <span>🎲 Sortear essa Bagunça</span>
        </button>
      )}

      {isGenerating && (
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-neutral-400 italic font-mono text-xs">Peraí que tô bolando os times...</p>
        </div>
      )}

      {teams && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['A', 'B', 'C'].map((t) => (
              <div key={t} className="bg-neutral-800 p-4 border-t-4 border-indigo-600 shadow-lg">
                <h4 className="text-center font-oswald text-xl mb-4 text-indigo-400 uppercase tracking-tighter">Bonde {t}</h4>
                <ul className="space-y-2">
                  {teams[t as 'A' | 'B' | 'C'].map((name, i) => (
                    <li key={i} className="text-center bg-neutral-900/50 py-1 text-sm font-bold text-neutral-300 border border-neutral-700/50 font-mono uppercase">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {aiComment && (
            <div className="bg-neutral-800 border-l-4 border-indigo-700 p-4 italic relative overflow-hidden">
              <span className="absolute -top-2 -left-2 text-6xl text-white/5 font-black pointer-events-none">"</span>
              <p className="text-neutral-300 leading-relaxed font-mono text-sm relative z-10">{aiComment}</p>
            </div>
          )}

          {!isMatchActive ? (
            <button
              onClick={() => setIsMatchActive(true)}
              className="w-full bg-red-700 hover:bg-red-600 py-4 font-oswald text-xl uppercase tracking-widest transition-all"
            >
              Começar Pelada (TIRO E QUEDA)
            </button>
          ) : (
            <div className="space-y-6">
              <div className="bg-black border border-neutral-800 p-8 text-center flex flex-col items-center">
                <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Placar da Desgraça</div>
                <div className="flex items-center gap-12">
                  <div className="flex flex-col items-center">
                    <span className="text-neutral-500 font-oswald uppercase text-xs mb-2 tracking-widest">Bonde A</span>
                    <span className="text-7xl font-oswald font-black text-white">{score.A}</span>
                    <button onClick={() => setScore(s => ({ ...s, A: s.A + 1 }))} className="mt-4 p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-none border border-neutral-700">+</button>
                  </div>
                  <div className="text-4xl font-oswald font-bold text-red-600 italic">X</div>
                  <div className="flex flex-col items-center">
                    <span className="text-neutral-500 font-oswald uppercase text-xs mb-2 tracking-widest">Bonde B</span>
                    <span className="text-7xl font-oswald font-black text-white">{score.B}</span>
                    <button onClick={() => setScore(s => ({ ...s, B: s.B + 1 }))} className="mt-4 p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-none border border-neutral-700">+</button>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 p-6">
                <h3 className="text-sm font-oswald uppercase text-neutral-400 mb-4 tracking-widest">Registrar Vergonha Online</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Tropeçou', 'Furou', 'Gol Contra', 'Arregou'].map(evt => (
                    <button
                      key={evt}
                      onClick={() => setGameEvents(prev => [{ type: evt, player: teams.A[0], time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...prev])}
                      className="text-[10px] bg-neutral-800 hover:bg-red-900 hover:text-white transition-all py-2 border border-neutral-700 text-neutral-400 font-mono uppercase font-bold"
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              </div>

              {gameEvents.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                  {gameEvents.map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-neutral-800/40 border-l-2 border-red-600">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-neutral-600 font-mono italic">{e.time}</span>
                        <span className="text-xs text-white uppercase font-bold font-mono">#{e.player}</span>
                        <span className="text-xs text-red-500 uppercase font-bold font-mono">{e.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setIsMatchActive(false);
                  setTeams(null);
                  setScore({ A: 0, B: 0 });
                  setGameEvents([]);
                }}
                className="w-full bg-neutral-800 hover:bg-black py-4 font-oswald text-xs uppercase tracking-widest transition-all border border-neutral-700 text-neutral-500"
              >
                Encerrar Partida e Gravar Vexame
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchControl;
