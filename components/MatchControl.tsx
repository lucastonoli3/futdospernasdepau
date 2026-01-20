import React, { useState } from 'react';
import { Player } from '../types';
import { aiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface MatchControlProps {
  players: Player[];
  currentUser: Player;
}

const MatchControl: React.FC<MatchControlProps> = ({ players, currentUser }) => {
  const [numTeams, setNumTeams] = useState<3 | 4>(() => {
    const saved = localStorage.getItem('fdp_num_teams');
    return saved ? parseInt(saved) as 3 | 4 : 3;
  });
  const [teams, setTeams] = useState<{ A: Player[], B: Player[], C: Player[], D: Player[] } | null>(() => {
    const saved = localStorage.getItem('fdp_teams');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTeams, setActiveTeams] = useState<{ left: 'A' | 'B' | 'C' | 'D', right: 'A' | 'B' | 'C' | 'D' }>(() => {
    const saved = localStorage.getItem('fdp_active_teams');
    return saved ? JSON.parse(saved) : { left: 'A', right: 'B' };
  });
  const [aiComment, setAiComment] = useState<string>(() => localStorage.getItem('fdp_ai_comment') || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMatchActive, setIsMatchActive] = useState(() => localStorage.getItem('fdp_match_active') === 'true');
  const [score, setScore] = useState(() => {
    const saved = localStorage.getItem('fdp_score');
    return saved ? JSON.parse(saved) : { left: 0, right: 0 };
  });
  const [gameEvents, setGameEvents] = useState<{ type: string, player: string, detail?: string, time: string }[]>(() => {
    const saved = localStorage.getItem('fdp_game_events');
    return saved ? JSON.parse(saved) : [];
  });
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [matchTime, setMatchTime] = useState(() => {
    const saved = localStorage.getItem('fdp_match_time');
    return saved ? parseInt(saved) : 0;
  });

  // Persistence Effects
  React.useEffect(() => {
    localStorage.setItem('fdp_num_teams', numTeams.toString());
  }, [numTeams]);

  React.useEffect(() => {
    if (teams) localStorage.setItem('fdp_teams', JSON.stringify(teams));
    else localStorage.removeItem('fdp_teams');
  }, [teams]);

  React.useEffect(() => {
    localStorage.setItem('fdp_active_teams', JSON.stringify(activeTeams));
  }, [activeTeams]);

  React.useEffect(() => {
    localStorage.setItem('fdp_score', JSON.stringify(score));
  }, [score]);

  React.useEffect(() => {
    localStorage.setItem('fdp_match_active', isMatchActive.toString());
  }, [isMatchActive]);

  React.useEffect(() => {
    localStorage.setItem('fdp_match_time', matchTime.toString());
  }, [matchTime]);

  React.useEffect(() => {
    localStorage.setItem('fdp_game_events', JSON.stringify(gameEvents));
  }, [gameEvents]);

  React.useEffect(() => {
    localStorage.setItem('fdp_ai_comment', aiComment);
  }, [aiComment]);

  // Timer logic
  React.useEffect(() => {
    let interval: any;
    if (isMatchActive) {
      interval = setInterval(() => {
        setMatchTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isMatchActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // States for event selection
  const [showGoalModal, setShowGoalModal] = useState<{ side: 'left' | 'right' } | null>(null);
  const [showHumiliationModal, setShowHumiliationModal] = useState<{ type: string } | null>(null);
  const [goalScorer, setGoalScorer] = useState<Player | null>(null);
  const [goalAssistant, setGoalAssistant] = useState<Player | null>(null);
  const [aggressor, setAggressor] = useState<Player | null>(null);
  const [victim, setVictim] = useState<Player | null>(null);

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

  const maxPlayers = numTeams * 5;
  const mainListIds = confirmedIds.slice(0, maxPlayers);
  const waitListIds = confirmedIds.slice(maxPlayers);

  const handleConfirm = async (id: string) => {
    if (id !== currentUser.id) return;

    let newConfirmed;
    if (confirmedIds.includes(id)) {
      // Proibido cancelar segundo a regra do bueiro
      alert("⚠️ REGRA DE OURO: Confirmou? Agora paga o jogo ou comparece. Sem cancelamentos!");
      return;
    } else {
      newConfirmed = [...confirmedIds, id];
    }

    setConfirmedIds(newConfirmed);
    const { error } = await supabase.from('sessions').update({ players_present: newConfirmed }).eq('id', 1);

    if (!error) {
      const isConfirming = !confirmedIds.includes(id);
      // Notificar Webhook do Make
      fetch('https://hook.us2.make.com/9047p2y3vlis2gepi28i2md83cp0515d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors', // Tentar sem CORS se o Make estiver bloqueando
        body: JSON.stringify({
          event: isConfirming ? 'confirmacao_presenca' : 'cancelamento_presenca',
          player_nickname: currentUser.nickname,
          total_confirmed: newConfirmed.length,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.error('Erro ao notificar webhook:', err));
    }
  };

  const drawTeams = async () => {
    const minPlayers = numTeams * 3;
    if (mainListIds.length < minPlayers) {
      alert(`Poucos viciados confirmados. Para ${numTeams} times precisamos de pelo menos ${minPlayers} bonecos.`);
      return;
    }

    setIsGenerating(true);

    const presentPlayers = mainListIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => (b.moralScore || 0) - (a.moralScore || 0));

    const teamA: Player[] = [];
    const teamB: Player[] = [];
    const teamC: Player[] = [];
    const teamD: Player[] = [];

    presentPlayers.forEach((p, index) => {
      const cycle = Math.floor(index / numTeams);
      const pos = index % numTeams;
      const isEvenCycle = cycle % 2 === 0;

      if (isEvenCycle) {
        if (pos === 0) teamA.push(p);
        else if (pos === 1) teamB.push(p);
        else if (pos === 2) teamC.push(p);
        else teamD.push(p);
      } else {
        if (numTeams === 3) {
          if (pos === 0) teamC.push(p);
          else if (pos === 1) teamB.push(p);
          else teamA.push(p);
        } else {
          if (pos === 0) teamD.push(p);
          else if (pos === 1) teamC.push(p);
          else if (pos === 2) teamB.push(p);
          else teamA.push(p);
        }
      }
    });

    const newTeams = { A: teamA, B: teamB, C: teamC, D: teamD };
    setTeams(newTeams);

    try {
      const comment = await aiService.generateTeamDrawComment(
        newTeams.A.map(p => p.nickname),
        newTeams.B.map(p => p.nickname),
        newTeams.C.map(p => p.nickname),
        numTeams === 4 ? newTeams.D.map(p => p.nickname) : undefined
      );
      setAiComment(comment || "Sorteio feito. Vai dar merda.");
    } catch (e) {
      setAiComment("A IA foi pro bueiro e não quer voltar.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isConfirmed = confirmedIds.includes(currentUser.id);

  const registerGoal = async () => {
    if (!goalScorer || !showGoalModal) return;

    const side = showGoalModal.side;
    setScore(s => ({ ...s, [side]: s[side] + 1 }));

    // Update Stats in DB
    await supabase.from('players').update({
      goals: (goalScorer.goals || 0) + 1,
      moral_score: Math.min(100, (goalScorer.moralScore || 0) + 2)
    }).eq('id', goalScorer.id);

    if (goalAssistant) {
      await supabase.from('players').update({
        assists: (goalAssistant.assists || 0) + 1,
        moral_score: Math.min(100, (goalAssistant.moralScore || 0) + 1)
      }).eq('id', goalAssistant.id);
    }

    const teamLetter = side === 'left' ? activeTeams.left : activeTeams.right;
    const eventDesc = `GOL (${teamLetter}): ${goalScorer.nickname}${goalAssistant ? ` (ASS: ${goalAssistant.nickname})` : ''}`;
    setGameEvents(prev => [{
      type: 'GOL',
      player: `${goalScorer.nickname} (${teamLetter})`,
      detail: goalAssistant ? `Assist: ${goalAssistant.nickname}` : undefined,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }, ...prev]);

    // Reset and close
    setGoalScorer(null);
    setGoalAssistant(null);
    setShowGoalModal(null);
  };

  const registerHumiliation = async () => {
    if (!aggressor || !victim || !showHumiliationModal) return;

    // Insert into humiliations table
    await supabase.from('humiliations').insert([{
      performer_id: aggressor.id,
      performerNickname: aggressor.nickname,
      victim_id: victim.id,
      victimNickname: victim.nickname,
      type: showHumiliationModal.type,
      description: `${aggressor.nickname} deu um(a) ${showHumiliationModal.type} no(a) ${victim.nickname}!`,
      status: 'pending'
    }]);

    setGameEvents(prev => [{
      type: showHumiliationModal.type,
      player: `${aggressor.nickname} vs ${victim.nickname}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }, ...prev]);

    // Reset and close
    setAggressor(null);
    setVictim(null);
    setShowHumiliationModal(null);
  };

  const handleNextMatch = () => {
    const winnerSide = score.left > score.right ? 'left' : (score.right > score.left ? 'right' : 'none');
    const teamsList: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', numTeams === 4 ? 'D' : null].filter((t): t is 'A' | 'B' | 'C' | 'D' => !!t);

    let nextLeft = activeTeams.left;
    let nextRight = activeTeams.right;

    if (winnerSide === 'left') {
      // Winner stays on left, replace right
      const currentIdx = teamsList.indexOf(activeTeams.right);
      const nextIdx = (currentIdx + 1) % teamsList.length;
      nextRight = teamsList[nextIdx];
      if (nextRight === activeTeams.left) {
        nextRight = teamsList[(nextIdx + 1) % teamsList.length];
      }
    } else if (winnerSide === 'right') {
      // Winner stays on right (move to left for convention?), replace left
      const currentIdx = teamsList.indexOf(activeTeams.left);
      const nextIdx = (currentIdx + 1) % teamsList.length;
      nextLeft = teamsList[nextIdx];
      if (nextLeft === activeTeams.right) {
        nextLeft = teamsList[(nextIdx + 1) % teamsList.length];
      }
    } else {
      // Draw: usually both out or challenger stays. Let's just cycle both for simplicity or ask.
      // For now, let's just cycle the "right" team as a default challenger rotation.
      const currentIdx = teamsList.indexOf(activeTeams.right);
      const nextIdx = (currentIdx + 1) % teamsList.length;
      nextRight = teamsList[nextIdx];
      if (nextRight === activeTeams.left) {
        nextRight = teamsList[(nextIdx + 1) % teamsList.length];
      }
    }

    setActiveTeams({ left: nextLeft, right: nextRight });
    setScore({ left: 0, right: 0 });
    setMatchTime(0);
    setGameEvents([]);
    alert(`Próximo Confronto: Bonde ${nextLeft} vs Bonde ${nextRight}`);
  };

  const shareOnWhatsApp = () => {
    const mainList = mainListIds
      .map((id, index) => {
        const p = players.find(player => player.id === id);
        return p ? `${(index + 1).toString().padStart(2, '0')}. ${p.nickname}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const waitList = waitListIds
      .map((id, index) => {
        const p = players.find(player => player.id === id);
        return p ? `${(index + 1).toString().padStart(2, '0')}. ${p.nickname}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const msg = `*🏟️ LISTA DE PRESENÇA - PELADA DOS PERNAS DE PAU 🏟️*\n\n` +
      `*TITULARES:* \n${mainList || '_Vazio_'}\n\n` +
      (waitList ? `*FILA DE ESPERA:* \n${waitList}\n\n` : '') +
      `*TOTAL:* ${confirmedIds.length} bonecos confirmados\n\n` +
      `_Acesse e confirme sua presença no sistema:_ \nhttps://fut-dos-pernas-de-pau.vercel.app/`;

    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto animate-slide-up pb-24 space-y-8">
      {/* MODALS - MOVED TO TOP FOR RELIABILITY */}
      {showGoalModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel border border-white/20 p-8 rounded-[40px] shadow-[0_0_100px_rgba(255,255,255,0.1)] space-y-6">
            <h3 className="text-2xl font-oswald font-black text-white uppercase italic text-center">GOL CONFIRMADO - Bonde {showGoalModal.side === 'left' ? activeTeams.left : activeTeams.right}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black px-1">Quem mandou pro fundo?</label>
                <select
                  className="w-full bg-black border border-neutral-800 p-4 text-white font-oswald uppercase italic rounded-2xl outline-none focus:border-red-600 appearance-none shadow-inner"
                  onChange={(e) => {
                    const teamLetter = showGoalModal.side === 'left' ? activeTeams.left : activeTeams.right;
                    setGoalScorer(teams![teamLetter].find(p => p.id === e.target.value) || null);
                  }}
                  value={goalScorer?.id || ''}
                >
                  <option value="">Selecione o Matador...</option>
                  {(teams![showGoalModal.side === 'left' ? activeTeams.left : activeTeams.right] || []).map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black px-1 text-neutral-700">Assistência (Opcional)</label>
                <select
                  className="w-full bg-black border border-neutral-800 p-4 text-white font-oswald uppercase italic rounded-2xl outline-none focus:border-red-600 opacity-60 appearance-none shadow-inner"
                  onChange={(e) => {
                    const teamLetter = showGoalModal.side === 'left' ? activeTeams.left : activeTeams.right;
                    setGoalAssistant(teams![teamLetter].find(p => p.id === e.target.value) || null);
                  }}
                  value={goalAssistant?.id || ''}
                >
                  <option value="">Sem Assistência</option>
                  {(teams![showGoalModal.side === 'left' ? activeTeams.left : activeTeams.right] || []).filter(p => p.id !== goalScorer?.id).map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={() => { setShowGoalModal(null); setGoalScorer(null); setGoalAssistant(null); }} className="p-4 bg-neutral-900 text-neutral-500 font-oswald font-black uppercase italic rounded-2xl border border-neutral-800">Abortar</button>
              <button onClick={registerGoal} disabled={!goalScorer} className="p-4 bg-red-600 text-white font-oswald font-black uppercase italic rounded-2xl disabled:opacity-30 shadow-lg shadow-red-900/20 transition-all">DECRETAR GOL</button>
            </div>
          </div>
        </div>
      )}

      {showHumiliationModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel border border-red-900/30 p-8 rounded-[40px] shadow-[0_0_100px_rgba(220,38,38,0.1)] space-y-6 animate-scale-in">
            <h3 className="text-2xl font-oswald font-black text-red-600 uppercase italic text-center">REPORTAR {showHumiliationModal.type}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black px-1">Autor do Vexame</label>
                <select
                  className="w-full bg-black border border-neutral-800 p-4 text-white font-oswald uppercase italic rounded-2xl outline-none focus:border-red-600 appearance-none shadow-inner"
                  onChange={(e) => setAggressor(players.find(p => p.id === e.target.value) || null)}
                  value={aggressor?.id || ''}
                >
                  <option value="">Quem fez a merda?</option>
                  {players.sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              </div>

              <div className="flex justify-center -my-2">
                <span className="text-red-900 font-black text-xl">VS</span>
              </div>

              <div>
                <label className="text-[10px] text-neutral-500 uppercase font-black px-1">Vítima do Crime</label>
                <select
                  className="w-full bg-black border border-neutral-800 p-4 text-white font-oswald uppercase italic rounded-2xl outline-none focus:border-red-600 appearance-none shadow-inner"
                  onChange={(e) => setVictim(players.find(p => p.id === e.target.value) || null)}
                  value={victim?.id || ''}
                >
                  <option value="">Quem sofreu?</option>
                  {players.sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={() => { setShowHumiliationModal(null); setAggressor(null); setVictim(null); }} className="p-4 bg-neutral-900 text-neutral-500 font-oswald font-black uppercase italic rounded-2xl border border-neutral-800">Arregar</button>
              <button onClick={registerHumiliation} disabled={!aggressor || !victim} className="p-4 bg-red-600 text-white font-oswald font-black uppercase italic rounded-2xl disabled:opacity-30 shadow-lg shadow-red-900/20">PROTOCOLAR</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between px-2 gap-4">
        <div>
          <h2 className="section-title text-4xl md:text-5xl text-white uppercase italic">Campo de <span className="text-red-600">Batalha</span></h2>
          <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.4em] mt-1">Status da Lista: {mainListIds.length >= 15 ? 'LOTADA' : 'RECRUTANDO'}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass-panel border-neutral-800/50 p-4 rounded-2xl flex items-center gap-6">
            <div className="text-center">
              <p className="text-[9px] text-neutral-500 uppercase font-black mb-1">Confirmados</p>
              <p className="text-2xl font-oswald text-white font-black italic">{confirmedIds.length}</p>
            </div>
            <div className="h-8 w-[1px] bg-neutral-800"></div>
            <div className="text-center">
              <p className="text-[9px] text-neutral-500 uppercase font-black mb-1">Vagas</p>
              <p className="text-2xl font-oswald text-red-600 font-black italic">{Math.max(0, (numTeams * 5) - confirmedIds.length)}</p>
            </div>
          </div>
          <button
            onClick={shareOnWhatsApp}
            className="h-[68px] w-[68px] flex items-center justify-center bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-2xl hover:bg-[#25D366] hover:text-white transition-all shadow-lg active:scale-95"
            title="Compartilhar no WhatsApp"
          >
            <span className="text-2xl">📱</span>
          </button>
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
              disabled={isConfirmed}
              className={`w-full md:w-auto px-12 py-5 font-oswald font-black uppercase italic tracking-[0.2em] rounded-2xl transition-all shadow-xl ${isConfirmed
                ? 'bg-neutral-800/50 border border-neutral-700/50 text-red-700 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/20 active:scale-95'}`}
            >
              {isConfirmed ? 'MISSÃO CONFIRMADA 💀' : 'CONFIRMAR PRESENÇA'}
            </button>
          </div>
        </div>

        {/* LISTA TITULAR */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] italic">Bonde Titular <span className="text-red-600">/ {numTeams * 5}</span></h3>
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

      {/* TEAM COUNT SELECTOR */}
      <div className="px-2 flex justify-center gap-4 mb-4">
        <button
          onClick={() => setNumTeams(3)}
          className={`px-6 py-2 rounded-xl font-oswald font-black uppercase italic transition-all ${numTeams === 3 ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}
        >
          3 Times (15 bonecos)
        </button>
        <button
          onClick={() => setNumTeams(4)}
          className={`px-6 py-2 rounded-xl font-oswald font-black uppercase italic transition-all ${numTeams === 4 ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}
        >
          4 Times (20 bonecos)
        </button>
      </div>

      {mainListIds.length >= (numTeams * 3) && !teams && (
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
          <div className={`grid grid-cols-1 ${numTeams === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
            {['A', 'B', 'C', numTeams === 4 ? 'D' : null].filter(Boolean).map((label) => (
              <div key={label} className="glass-panel border-white/5 rounded-[32px] overflow-hidden group hover:border-red-600/20 transition-all">
                <div className="bg-red-600/10 p-4 border-b border-white/5 text-center">
                  <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1">Squad do Mal</p>
                  <h4 className="text-3xl font-oswald text-white font-black uppercase italic">Bonde {label}</h4>
                </div>
                <div className="p-4 space-y-2 bg-gradient-to-b from-black/0 to-black/40">
                  {teams[label as 'A' | 'B' | 'C' | 'D'].map((player, i) => (
                    <div key={i} className="text-center py-3 bg-white/5 border border-white/5 rounded-xl text-sm font-oswald text-neutral-300 uppercase italic font-bold">
                      {player.nickname}
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
              <div className="glass-panel border-red-600/30 p-8 rounded-[40px] text-center bg-black/60 relative overflow-hidden backdrop-blur-3xl shadow-[0_0_50px_rgba(220,38,38,0.1)]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 px-6 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-b-2xl italic">LIVE_MATCH</div>

                {/* TIMER */}
                <div className="mb-6">
                  <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.3em] mb-1">Tempo de Batalha</p>
                  <p className="text-5xl font-mono font-black text-white italic tracking-tighter shadow-red-600/20">{formatTime(matchTime)}</p>
                </div>

                <div className="flex items-start justify-center gap-6 md:gap-14 mt-4">
                  {/* LEFT TEAM */}
                  <div className="flex flex-col items-center flex-1 space-y-4">
                    <select
                      value={activeTeams.left}
                      onChange={(e) => setActiveTeams(prev => ({ ...prev, left: e.target.value as any }))}
                      className="bg-red-600/10 border border-white/5 px-4 py-2 text-white font-oswald uppercase text-sm italic outline-none cursor-pointer rounded-xl"
                    >
                      {['A', 'B', 'C', numTeams === 4 ? 'D' : null].filter(Boolean).map(t => (
                        <option key={t} value={t!} className="bg-black text-white">Bonde {t}</option>
                      ))}
                    </select>

                    <div className="relative group">
                      <span className="text-8xl md:text-9xl font-oswald font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{score.left}</span>
                      <button onClick={() => setShowGoalModal({ side: 'left' })} className="absolute -right-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-white text-black font-black text-xl rounded-xl hover:bg-neutral-200 transition-all active:scale-90 shadow-xl">+</button>
                    </div>

                    {/* PLAYER LIST LEFT */}
                    <div className="w-full space-y-1 opacity-50">
                      {teams![activeTeams.left].map((p, i) => (
                        <p key={i} className="text-[9px] font-oswald uppercase text-neutral-400 italic font-bold truncate">{p.nickname}</p>
                      ))}
                    </div>
                  </div>

                  <div className="text-4xl font-oswald font-black text-red-600 italic opacity-50 select-none self-center">VS</div>

                  {/* RIGHT TEAM */}
                  <div className="flex flex-col items-center flex-1 space-y-4">
                    <select
                      value={activeTeams.right}
                      onChange={(e) => setActiveTeams(prev => ({ ...prev, right: e.target.value as any }))}
                      className="bg-red-600/10 border border-white/5 px-4 py-2 text-white font-oswald uppercase text-sm italic outline-none cursor-pointer rounded-xl"
                    >
                      {['A', 'B', 'C', numTeams === 4 ? 'D' : null].filter(Boolean).map(t => (
                        <option key={t} value={t!} className="bg-black text-white">Bonde {t}</option>
                      ))}
                    </select>

                    <div className="relative group">
                      <span className="text-8xl md:text-9xl font-oswald font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{score.right}</span>
                      <button onClick={() => setShowGoalModal({ side: 'right' })} className="absolute -left-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-white text-black font-black text-xl rounded-xl hover:bg-neutral-200 transition-all active:scale-90 shadow-xl">+</button>
                    </div>

                    {/* PLAYER LIST RIGHT */}
                    <div className="w-full space-y-1 opacity-50">
                      {teams![activeTeams.right].map((p, i) => (
                        <p key={i} className="text-[9px] font-oswald uppercase text-neutral-400 italic font-bold truncate">{p.nickname}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { id: 'CANETA', label: '🥢 CANETA', type: 'CANETA' },
                  { id: 'CHAPEU', label: '👒 CHAPÉU', type: 'CHAPÉU' },
                  { id: 'FRANGO', label: '🐔 FRANGO', type: 'FRANGO' },
                  { id: 'FURADA', label: '👟 FURADA', type: 'FURADA' },
                  { id: 'ARREGO', label: '🏳️ ARREGO', type: 'ARREGO' }
                ].map(evt => (
                  <button
                    key={evt.id}
                    onClick={() => setShowHumiliationModal({ type: evt.type })}
                    className="p-4 bg-neutral-900/50 border border-neutral-800 hover:border-red-600 hover:text-white transition-all text-neutral-500 font-oswald font-black uppercase text-[10px] italic tracking-widest rounded-2xl flex flex-col items-center gap-1"
                  >
                    <span className="text-lg">{evt.label.split(' ')[0]}</span>
                    <span>{evt.label.split(' ')[1]}</span>
                  </button>
                ))}
              </div>

              {gameEvents.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {gameEvents.map((e, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl animate-slide-up">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] text-neutral-600 font-mono italic">{e.time}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-red-500 uppercase font-black font-oswald italic tracking-widest">{e.type}: {e.player}</span>
                            <span className="text-neutral-700 font-mono text-[10px]">detected</span>
                          </div>
                          {e.detail && <p className="text-[9px] text-neutral-500 font-mono uppercase mt-1">{e.detail}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={handleNextMatch}
                  className="flex-1 py-4 bg-green-600/20 border border-green-600/30 text-green-500 font-oswald font-black uppercase italic rounded-2xl hover:bg-green-600 hover:text-white transition-all shadow-lg active:scale-95"
                >
                  ⏭️ Próxima Partida (Ganha-Fica)
                </button>
                <button
                  onClick={() => {
                    if (confirm('ENCERRAR E GRAVAR VEXAMES?')) {
                      setIsMatchActive(false);
                      setTeams(null);
                      setScore({ left: 0, right: 0 });
                      setGameEvents([]);
                      setMatchTime(0);

                      localStorage.removeItem('fdp_teams');
                      localStorage.removeItem('fdp_score');
                      localStorage.removeItem('fdp_match_active');
                      localStorage.removeItem('fdp_match_time');
                      localStorage.removeItem('fdp_game_events');
                      localStorage.removeItem('fdp_ai_comment');
                      localStorage.removeItem('fdp_active_teams');
                      alert("SESSÃO ENCERRADA. OS DADOS FORAM LIMPOS. PRÓXIMA SEMANA TEM MAIS! ⚽💀");
                    }
                  }}
                  className="flex-1 py-4 bg-red-600/10 border border-red-600/20 text-red-500 font-oswald font-black uppercase italic rounded-2xl hover:bg-red-600 hover:text-white transition-all"
                >
                  🛑 ENCERRAR SESSÃO
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchControl;
