import React, { useState } from 'react';
import { Player, Position, PlayerStatus, MatchSession } from '../types';
import { aiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface MatchControlProps {
  players: Player[];
  currentUser: Player;
  currentSession: MatchSession;
  isTrainingMode: boolean;
  trainingConfirmedIds: string[];
  setTrainingConfirmedIds: (ids: string[]) => void;
}

const MOCK_PLAYERS: Player[] = [
  { id: 'm1', name: 'Bagre 1', nickname: 'Bagre de Aluguel', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418139.png', moralScore: 45, goals: 0, assists: 0, badges: [], matchesPlayed: 10, bestVotes: 0, worstVotes: 5, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm2', name: 'Zagueiro 2', nickname: 'Zagueiro Binário', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418141.png', moralScore: 55, goals: 0, assists: 0, badges: [], matchesPlayed: 12, bestVotes: 1, worstVotes: 2, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm3', name: 'Artilheiro 3', nickname: 'Artilheiro de 1 Reau', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418143.png', moralScore: 85, goals: 5, assists: 2, badges: ['ch1'], matchesPlayed: 8, bestVotes: 3, worstVotes: 0, position: Position.LINHA, status: PlayerStatus.HOT, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm4', name: 'Luva 4', nickname: 'Luva de Pedreiro (Fake)', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418145.png', moralScore: 70, goals: 2, assists: 1, badges: [], matchesPlayed: 15, bestVotes: 2, worstVotes: 1, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm5', name: 'Kross 5', nickname: 'Kross do Camelô', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418147.png', moralScore: 65, goals: 1, assists: 4, badges: [], matchesPlayed: 10, bestVotes: 1, worstVotes: 1, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm6', name: 'Dono 6', nickname: 'Dono da Bola', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418149.png', moralScore: 50, goals: 0, assists: 0, badges: ['f1'], matchesPlayed: 20, bestVotes: 0, worstVotes: 3, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm7', name: 'Gandula 7', nickname: 'Gandula Profissa', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418151.png', moralScore: 40, goals: 0, assists: 0, badges: [], matchesPlayed: 30, bestVotes: 0, worstVotes: 0, position: Position.LINHA, status: PlayerStatus.GHOST, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm8', name: 'Pelé 8', nickname: 'Pelé do Churrasco', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418153.png', moralScore: 90, goals: 12, assists: 5, badges: ['mvp'], matchesPlayed: 5, bestVotes: 5, worstVotes: 0, position: Position.LINHA, status: PlayerStatus.HOT, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm9', name: 'Cansado 9', nickname: 'Cansado da Silva', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418155.png', moralScore: 30, goals: 0, assists: 0, badges: [], matchesPlayed: 40, bestVotes: 0, worstVotes: 10, position: Position.LINHA, status: PlayerStatus.LOW, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm10', name: 'Meia 10', nickname: 'Meia Boca', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418157.png', moralScore: 50, goals: 1, assists: 1, badges: [], matchesPlayed: 10, bestVotes: 1, worstVotes: 1, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm11', name: 'Canela 11', nickname: 'Canela de Vidro', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418159.png', moralScore: 45, goals: 0, assists: 1, badges: [], matchesPlayed: 2, bestVotes: 0, worstVotes: 0, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm12', name: 'Goleiro 12', nickname: 'Goleiro Mão de Alface', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418161.png', moralScore: 35, goals: 0, assists: 0, badges: [], matchesPlayed: 25, bestVotes: 0, worstVotes: 8, position: Position.GOLEIRO, status: PlayerStatus.LOW, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm13', name: 'Ronaldinho 13', nickname: 'Ronaldinho do Paraguai', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418163.png', moralScore: 75, goals: 3, assists: 3, badges: [], matchesPlayed: 7, bestVotes: 2, worstVotes: 1, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm14', name: 'Perna 14', nickname: 'Perna de Grilo', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418165.png', moralScore: 55, goals: 1, assists: 0, badges: [], matchesPlayed: 14, bestVotes: 1, worstVotes: 1, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, specialEvents: [] },
  { id: 'm15', name: 'Admin 15', nickname: 'Admin do Bueiro', photo: 'https://cdn-icons-png.flaticon.com/512/3418/3418167.png', moralScore: 60, goals: 0, assists: 1, badges: ['f1'], matchesPlayed: 50, bestVotes: 0, worstVotes: 0, position: Position.LINHA, status: PlayerStatus.NORMAL, debt: 0, isPaid: true, is_admin: true, specialEvents: [] }
];

const MatchControl: React.FC<MatchControlProps> = ({
  players: realPlayers,
  currentUser,
  currentSession,
  isTrainingMode,
  trainingConfirmedIds,
  setTrainingConfirmedIds
}) => {
  if (!currentSession) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <div className="w-12 h-12 border-4 border-red-900 border-t-red-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-neutral-500 font-mono text-[10px] uppercase tracking-widest">Carregando Sessão...</p>
      </div>
    );
  }

  const [numTeams, setNumTeams] = useState<3 | 4>(() => {
    const saved = localStorage.getItem('fdp_num_teams');
    return saved ? parseInt(saved) as 3 | 4 : 3;
  });
  const [teams, setTeams] = useState<{ A: Player[], B: Player[], C: Player[], D: Player[] } | null>(() => {
    try {
      const saved = localStorage.getItem('fdp_teams');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Validar se os times têm estrutura mínima
      if (parsed && typeof parsed === 'object' && parsed.A) return parsed;
      return null;
    } catch (e) {
      localStorage.removeItem('fdp_teams');
      return null;
    }
  });
  const [activeTeams, setActiveTeams] = useState<{ left: 'A' | 'B' | 'C' | 'D', right: 'A' | 'B' | 'C' | 'D' }>(() => {
    try {
      const saved = localStorage.getItem('fdp_active_teams');
      if (!saved) return { left: 'A', right: 'B' };
      const parsed = JSON.parse(saved);
      // Se estamos com 3 times mas os times salvos eram D, reseta
      if (numTeams === 3 && (parsed.left === 'D' || parsed.right === 'D')) {
        return { left: 'A', right: 'B' };
      }
      return parsed;
    } catch (e) {
      return { left: 'A', right: 'B' };
    }
  });
  const [aiComment, setAiComment] = useState<string>(() => localStorage.getItem('fdp_ai_comment') || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMatchActive, setIsMatchActive] = useState(() => localStorage.getItem('fdp_match_active') === 'true');
  const [score, setScore] = useState(() => {
    try {
      const saved = localStorage.getItem('fdp_score');
      return saved ? JSON.parse(saved) : { left: 0, right: 0 };
    } catch (e) {
      return { left: 0, right: 0 };
    }
  });
  const [gameEvents, setGameEvents] = useState<{ type: string, player: string, detail?: string, time: string }[]>(() => {
    try {
      const saved = localStorage.getItem('fdp_game_events');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [matchTime, setMatchTime] = useState(() => {
    const saved = localStorage.getItem('fdp_match_time');
    return saved ? parseInt(saved) : 0;
  });
  const [isPaused, setIsPaused] = useState(() => localStorage.getItem('fdp_match_paused') === 'true');

  const players = isTrainingMode ? MOCK_PLAYERS : realPlayers;

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
    localStorage.setItem('fdp_match_paused', isPaused.toString());
  }, [isPaused]);

  React.useEffect(() => {
    localStorage.setItem('fdp_game_events', JSON.stringify(gameEvents));
  }, [gameEvents]);

  React.useEffect(() => {
    localStorage.setItem('fdp_ai_comment', aiComment);
  }, [aiComment]);

  // Timer logic
  React.useEffect(() => {
    let interval: any;
    if (isMatchActive && !isPaused) {
      interval = setInterval(() => {
        setMatchTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isMatchActive, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // MODAL STATES IMPROVED
  const [showEventModal, setShowEventModal] = useState<{ type: 'GOL' | 'CANETA' | 'CHAPEU' | 'FRANGO' | 'FURADA' | 'ARREGO', side?: 'left' | 'right' } | null>(null);

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
    if (isTrainingMode) return;
    const { data } = await supabase.from('sessions').select('players_present').eq('id', 1).single();
    if (data?.players_present) setConfirmedIds(data.players_present);
  };

  const effectiveConfirmedIds = isTrainingMode ? trainingConfirmedIds : confirmedIds;
  const maxPlayers = numTeams * 5;
  const mainListIds = effectiveConfirmedIds.slice(0, maxPlayers);
  const waitListIds = effectiveConfirmedIds.slice(maxPlayers);

  const handleConfirm = async (id: string) => {
    // No modo treino, qualquer clique em jogador confirma/cancela (para teste rápido)
    if (isTrainingMode) {
      const isCurrentlyConfirmed = trainingConfirmedIds.includes(id);
      if (isCurrentlyConfirmed) {
        setTrainingConfirmedIds(trainingConfirmedIds.filter(cid => cid !== id));
      } else {
        setTrainingConfirmedIds([...trainingConfirmedIds, id]);
      }
      return;
    }

    if (!currentUser || id !== currentUser.id) return;

    let newConfirmed;
    const isCurrentlyConfirmed = confirmedIds.includes(id);

    if (isCurrentlyConfirmed) {
      if (!confirm("Tem certeza que quer cancelar sua presença? Avisa a galera se for desistir, pra não furar o time.")) {
        return;
      }
      newConfirmed = confirmedIds.filter(cid => cid !== id);
    } else {
      newConfirmed = [...confirmedIds, id];
    }

    setConfirmedIds(newConfirmed);
    const { error } = await supabase.from('sessions').update({ players_present: newConfirmed }).eq('id', 1);

    if (!error) {
      // Notificar Webhook do Make
      fetch('https://hook.us2.make.com/9047p2y3vlis2gepi28i2md83cp0515d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          event: !isCurrentlyConfirmed ? 'confirmacao_presenca' : 'cancelamento_presenca',
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
      alert(`Poucos confirmados. Para ${numTeams} times precisamos de pelo menos ${minPlayers} jogadores.`);
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
      setAiComment(comment || "Times sorteados! Bola rolando.");
    } catch (e) {
      setAiComment("Times sorteados! Que comece a resenha.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isConfirmed = currentUser ? confirmedIds.includes(currentUser.id) : false;

  const handleRegisterGoal = async (scorer: Player, assistant: Player | null, side: 'left' | 'right') => {
    const teamLetter = side === 'left' ? activeTeams.left : activeTeams.right;
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setScore(s => ({ ...s, [side]: s[side] + 1 }));

    if (!isTrainingMode) {
      const { data: latestScorer } = await supabase.from('players').select('goals, moral_score').eq('id', scorer.id).single();
      const currentGoals = latestScorer?.goals || 0;
      const currentMoral = latestScorer?.moral_score || 0;

      await supabase.from('players').update({
        goals: currentGoals + 1,
        moral_score: Math.min(200, currentMoral + 2)
      }).eq('id', scorer.id);

      let assistantInfo = "";
      if (assistant) {
        const { data: latestAsst } = await supabase.from('players').select('assists, moral_score').eq('id', assistant.id).single();
        await supabase.from('players').update({
          assists: (latestAsst?.assists || 0) + 1,
          moral_score: Math.min(200, (latestAsst?.moral_score || 0) + 1)
        }).eq('id', assistant.id);
        assistantInfo = ` (Garçom: ${assistant.nickname})`;
      }

      await supabase.from('resenha_messages').insert([{
        player_id: scorer.id,
        text: `⚽ GOL DO BALAIO! [Time ${teamLetter}] ${scorer.nickname} mandou pro fundo da rede!${assistantInfo} - Placar: ${side === 'left' ? score.left + 1 : score.left}x${side === 'right' ? score.right + 1 : score.right}`
      }]);
    }

    setGameEvents(prev => [{
      type: 'GOL',
      player: `${scorer.nickname} (${teamLetter})`,
      detail: assistant ? `Assist: ${assistant.nickname}` : (isTrainingMode ? 'MODO TREINO' : undefined),
      time: timeStr
    }, ...prev]);

    setShowEventModal(null);
  };

  const handleRegisterHumiliation = async (perf: Player, vict: Player, type: string) => {
    if (!isTrainingMode) {
      const { error } = await supabase.from('humiliations').insert([{
        performer_id: perf.id,
        performerNickname: perf.nickname,
        victim_id: vict.id,
        victimNickname: vict.nickname,
        type: type,
        description: `${perf.nickname} deu um(a) ${type} no(a) ${vict.nickname}!`,
        status: 'confirmed'
      }]);

      if (!error) {
        const { data: pData } = await supabase.from('players').select('moral_score').eq('id', perf.id).single();
        const { data: vData } = await supabase.from('players').select('moral_score').eq('id', vict.id).single();

        await supabase.from('players').update({ moral_score: Math.min(200, (pData?.moral_score || 0) + 10) }).eq('id', perf.id);
        await supabase.from('players').update({ moral_score: Math.max(0, (vData?.moral_score || 0) - 10) }).eq('id', vict.id);

        await supabase.from('resenha_messages').insert([{
          player_id: perf.id,
          text: `🔥 RESENHA! ${perf.nickname} aplicou um(a) ${type} em ${vict.nickname}. A galera foi à loucura!`
        }]);
      }
    }

    setGameEvents(prev => [{
      type: type,
      player: `${perf.nickname} vs ${vict.nickname}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (isTrainingMode ? ' (TREINO)' : '')
    }, ...prev]);

    setShowEventModal(null);
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
    setIsPaused(false);
    setGameEvents([]);
    alert(`Próximo jogo: Time ${nextLeft} vs Time ${nextRight}`);
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

    const msg = `*⚽ LISTA DE PRESENÇA - BALAIO DE GATO FC ⚽*\n\n` +
      `*CONFIRMADOS:* \n${mainList || '_Vazio_'}\n\n` +
      (waitList ? `*FILA DE ESPERA:* \n${waitList}\n\n` : '') +
      `*TOTAL:* ${confirmedIds.length} sócios confirmados\n\n` +
      `_Confirme sua presença no app do Balaio:_ \nhttps://fut-dos-pernas-de-pau.vercel.app/`;

    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto animate-slide-up pb-24 space-y-8">
      {/* EVENT MODAL - ATOMS OF INTERACTION */}
      {showEventModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/98 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-2xl glass-panel border border-white/10 p-10 rounded-[48px] shadow-[0_0_100px_rgba(255,255,255,0.05)] space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-oswald font-black text-white uppercase italic tracking-tighter">
                {showEventModal.type === 'GOL' ? 'REGISTRAR GOL' : `REGISTRAR ${showEventModal.type}`}
              </h3>
              <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.4em]">Selecione os envolvidos no lance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* PRIMARY ACTOR (SCORER / AGGRESSOR) */}
              <div className="space-y-4">
                <p className="text-[10px] text-gold font-extrabold uppercase tracking-widest text-center italic">
                  {showEventModal.type === 'GOL' ? 'QUEM FEZ O GOL' : 'QUEM APLICOU'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[activeTeams.left, activeTeams.right].flatMap(t => teams![t!] || []).map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (showEventModal.type === 'GOL') {
                          const side = teams![activeTeams.left].includes(p) ? 'left' : 'right';
                          handleRegisterGoal(p, null, side);
                        } else {
                          // For humiliations, we need a victim. We store the first click as aggressor.
                          // But to keep it simple and one-tap:
                          (window as any)._aggressor = p;
                        }
                      }}
                      className="group flex flex-col items-center gap-2"
                    >
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/5 active:scale-90 transition-all group-hover:border-red-600">
                        <img src={p.photo} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] font-black uppercase text-neutral-500 group-hover:text-white truncate w-16 text-center">{p.nickname}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECONDARY ACTOR (ASSIST / VICTIM) - ONLY FOR HUMILIATIONS OR CUSTOM FLOW */}
              {showEventModal.type !== 'GOL' && (
                <div className="space-y-4">
                  <p className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest text-center italic">QUEM SOFREU</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[activeTeams.left, activeTeams.right].flatMap(t => teams![t!] || []).map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          const agg = (window as any)._aggressor;
                          if (agg && agg.id !== p.id) {
                            handleRegisterHumiliation(agg, p, showEventModal.type);
                          } else {
                            alert("Selecione o agressor primeiro!");
                          }
                        }}
                        className="group flex flex-col items-center gap-2"
                      >
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/5 active:scale-90 transition-all group-hover:border-red-900">
                          <img src={p.photo} className="w-full h-full object-cover grayscale group-hover:grayscale-0" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-neutral-700 group-hover:text-red-500 truncate w-16 text-center">{p.nickname}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6">
              <button
                onClick={() => setShowEventModal(null)}
                className="w-full py-4 bg-neutral-900 text-neutral-500 font-oswald font-black uppercase italic rounded-2xl border border-neutral-800 hover:text-white transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP TOGGLE - REMOVED AS REQUESTED (MOVED TO ADMIN) */}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between px-2 gap-4">
        <div>
          <h2 className="section-title text-4xl md:text-5xl text-white uppercase italic">
            {isTrainingMode ? <span className="text-gold">MODO</span> : 'Dia de'} <span className="text-gold">{isTrainingMode ? 'TESTE' : 'Jogo'}</span>
          </h2>
          <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.4em] mt-1">
            {isTrainingMode ? 'MODO TESTE ATIVO - PODE BRINCAR À VONTADE' : `Lista: ${mainListIds.length >= 15 ? 'CHEIA' : 'ABERTA'}`}
          </p>
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
            onClick={isTrainingMode ? () => alert("As fofocas de treino ficam no laboratório!") : shareOnWhatsApp}
            className={`h-[68px] w-[68px] flex items-center justify-center rounded-2xl transition-all shadow-lg active:scale-95 ${isTrainingMode ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500' : 'bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366] hover:text-white'}`}
            title={isTrainingMode ? "Bloqueado em Treino" : "Compartilhar no WhatsApp"}
          >
            <span className="text-2xl">{isTrainingMode ? '🧪' : '📱'}</span>
          </button>
        </div>
      </div>

      {/* WARNING BANNER */}
      <div className="mx-2 p-4 bg-gold/5 border border-gold/20 rounded-2xl flex items-start gap-4">
        <span className="text-2xl">📋</span>
        <div>
          <h4 className="font-oswald text-gold uppercase text-sm font-black italic tracking-widest">REGRA DA CASA</h4>
          <p className="text-[10px] text-neutral-400 font-mono leading-relaxed mt-1">
            CONFIRMOU PRESENÇA? <span className="text-white font-bold">APAREÇA.</span> Quem confirma e não vai atrapalha a resenha e o fechamento dos times. Combinado é combinado, sócio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-2">
        {/* PLAYER ACTION CARD */}
        <div className="lg:col-span-12 glass-panel border-white/5 p-6 rounded-[32px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="text-7xl font-black italic font-oswald text-white uppercase tracking-tighter">BALAIO</span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img src={currentUser?.photo} className={`w-20 h-20 object-cover rounded-2xl border-2 transition-all duration-500 ${isConfirmed ? 'border-gold shadow-[0_0_20px_rgba(245,197,24,0.3)]' : 'border-neutral-800 grayscale'}`} />
                {isConfirmed && <div className="absolute -top-2 -right-2 bg-gold text-black text-[8px] font-black px-2 py-1 rounded-md animate-bounce">PRONTO</div>}
              </div>
              <div>
                <p className="text-2xl font-oswald text-white uppercase italic font-black leading-tight">{isTrainingMode ? 'DEBUG_USER' : currentUser?.nickname}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${isConfirmed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-neutral-700'}`}></span>
                  <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">
                    {isConfirmed ? (mainListIds.includes(isTrainingMode ? currentUser?.id || 'debug' : currentUser?.id || '') ? 'TITULAR CONFIRMADO' : 'NA FILA DE ESPERA') : 'STATUS: DESCONECTADO'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => currentUser && handleConfirm(currentUser.id)}
              className={`w-full md:w-auto px-12 py-5 font-oswald font-black uppercase italic tracking-[0.2em] rounded-2xl transition-all shadow-xl ${isConfirmed
                ? 'bg-neutral-800 text-red-400 hover:bg-neutral-700 border border-red-900/30 active:scale-95'
                : 'bg-gold text-black hover:bg-gold-600 shadow-gold/20 active:scale-95'}`}
            >
              {isConfirmed ? 'CANCELAR PRESENÇA 🚫' : 'CONFIRMAR PRESENÇA'}
            </button>
          </div>
        </div>

        {/* LISTA TITULAR */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] italic">Confirmados <span className="text-gold">/ {numTeams * 5}</span></h3>
            <span className="text-[8px] font-mono text-neutral-500 uppercase">Ordem de Chegada</span>
          </div>

          <div className="glass-panel border-white/5 rounded-[32px] overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
              {mainListIds.length > 0 ? mainListIds.map((id, index) => {
                const p = players.find(player => player.id === id);
                if (!p) return null;
                const isMe = p.id === currentUser.id;
                return (
                  <div key={id} className={`flex items-center justify-between p-4 mb-2 rounded-2xl transition-all border ${isMe ? 'bg-gold/10 border-gold shadow-[inset_0_0_20px_rgba(245,197,24,0.05)]' : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-neutral-700 text-[10px] w-4 font-black">{(index + 1).toString().padStart(2, '0')}</span>
                      <img src={p.photo} className={`w-10 h-10 object-cover rounded-xl border ${isMe ? 'border-gold' : 'border-neutral-800'}`} />
                      <div>
                        <p className={`font-oswald uppercase italic font-black text-sm ${isMe ? 'text-white' : 'text-neutral-300'}`}>{p.nickname}</p>
                        <p className="text-[8px] text-neutral-600 uppercase font-mono tracking-tighter">Moral: {p.moralScore}</p>
                      </div>
                    </div>
                    {isMe && <span className="text-[8px] bg-gold text-black font-black px-2 py-1 rounded italic">VOCÊ</span>}
                  </div>
                );
              }) : (
                <div className="py-20 text-center opacity-20 grayscale">
                  <img src="/escudo.svg" alt="" className="w-16 h-16 object-contain mx-auto mb-4 opacity-40" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white">Ninguém confirmou ainda. Bora, galera!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LISTA DE ESPERA (XEPA) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em] italic">Fila de Espera / <span className="text-neutral-700">Suplentes</span></h3>
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
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white italic">Sem suplentes por enquanto.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isTrainingMode && (
        <div className="mx-2 p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-[32px] text-center space-y-2">
          <p className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em]">🧪 Ambiente de Testes Ativo</p>
          <p className="text-xs text-neutral-500 max-w-lg mx-auto leading-relaxed">
            Neste modo, o sistema está usando dados locais. Você pode clicar em qualquer jogador para confirmar/cancelar, fazer sorteios e registrar gols sem medo.
          </p>
        </div>
      )}

      {/* TEAM COUNT SELECTOR */}
      <div className="px-2 flex justify-center gap-4 mb-4">
        <button
          onClick={() => setNumTeams(3)}
          className={`px-6 py-2 rounded-xl font-oswald font-black uppercase italic transition-all ${numTeams === 3 ? 'bg-gold text-black shadow-lg shadow-gold/30' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}
        >
          3 Times (15 jogadores)
        </button>
        <button
          onClick={() => setNumTeams(4)}
          className={`px-6 py-2 rounded-xl font-oswald font-black uppercase italic transition-all ${numTeams === 4 ? 'bg-gold text-black shadow-lg shadow-gold/30' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}
        >
          4 Times (20 jogadores)
        </button>
      </div>

      {mainListIds.length >= (numTeams * 3) && !teams && (
        <div className="px-2 pt-8">
          <button
            onClick={drawTeams}
            disabled={isGenerating}
            className="w-full h-32 glass-panel border-gold/30 hover:border-gold bg-gold/5 transition-all active:scale-[0.98] group flex flex-col items-center justify-center rounded-[40px]"
          >
            {isGenerating ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-mono text-white uppercase tracking-[0.4em]">Sorteando os times...</p>
              </div>
            ) : (
              <>
                <span className="text-3xl mb-2 group-hover:scale-125 transition-transform duration-500">🎲</span>
                <span className="text-2xl font-oswald text-white font-black uppercase italic tracking-widest">SORTEAR TIMES</span>
                <p className="text-[10px] text-gold font-black uppercase mt-1 tracking-widest">Equilíbrio por moral do elenco</p>
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
              <div key={label} className="glass-panel border-white/5 rounded-[32px] overflow-hidden group hover:border-gold/20 transition-all">
                <div className="bg-gold/10 p-4 border-b border-white/5 text-center">
                  <p className="text-[10px] text-gold font-black uppercase tracking-widest mb-1">Escalação</p>
                  <h4 className="text-3xl font-oswald text-white font-black uppercase italic">Time {label}</h4>
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
            <div className="glass-panel border-gold/20 p-8 rounded-[32px] relative overflow-hidden bg-gold/[0.02]">
              <div className="absolute top-0 left-0 w-1 h-full bg-gold"></div>
              <span className="text-4xl text-gold/20 absolute -top-2 left-6 italic font-serif">"</span>
              <p className="text-sm font-mono text-neutral-300 leading-relaxed italic relative z-10 px-4">
                {aiComment}
              </p>
              <div className="mt-4 flex items-center gap-2 px-4 justify-end">
                <span className="text-[9px] text-gold font-black uppercase tracking-widest">— NARRADOR DO BALAIO</span>
              </div>
            </div>
          )}

          {/* LIVE MATCH CONTROLS */}
          {!isMatchActive ? (
            <button
              onClick={() => setIsMatchActive(true)}
              className="w-full py-6 bg-gold text-black font-oswald font-black text-2xl uppercase italic tracking-[0.2em] rounded-[32px] hover:bg-gold-600 shadow-2xl shadow-gold/20 transition-all active:scale-95 border-b-8 border-gold-700"
            >
              INICIAR PARTIDA
            </button>
          ) : (
            <div className="space-y-6 animate-slide-up">
              <div className="glass-panel border-gold/30 p-8 rounded-[40px] text-center bg-black/60 relative overflow-hidden backdrop-blur-3xl shadow-[0_0_50px_rgba(245,197,24,0.1)]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 px-6 py-2 bg-gold text-black text-[10px] font-black uppercase tracking-[0.5em] rounded-b-2xl italic">AO VIVO</div>

                {/* TIMER */}
                <div className="mb-6 relative group">
                  <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.3em] mb-1">Tempo de Batalha</p>
                  <div className="flex items-center justify-center gap-4">
                    <p className={`text-5xl font-mono font-black italic tracking-tighter shadow-red-600/20 ${isPaused ? 'text-yellow-500 animate-pulse' : 'text-white'}`}>
                      {formatTime(matchTime)}
                    </p>
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-green-600 text-white animate-bounce' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                      title={isPaused ? "Retomar" : "Pausar"}
                    >
                      <span className="text-xl">{isPaused ? '▶️' : '⏸️'}</span>
                    </button>
                  </div>
                  {isPaused && <p className="text-[9px] text-yellow-600 font-black uppercase tracking-widest mt-2">PARTIDA PAUSADA</p>}
                </div>

                <div className="flex items-center justify-between gap-4 md:gap-14 mt-4">
                  {/* LEFT TEAM TACTICAL */}
                  <div className="flex flex-col items-center flex-1 space-y-4">
                    <div className="flex flex-wrap justify-center gap-2 max-w-[200px]">
                      {teams![activeTeams.left].map((p, i) => (
                        <button
                          key={i}
                          onClick={() => handleRegisterGoal(p, null, 'left')}
                          className="group relative"
                        >
                          <img src={p.photo} className="w-8 h-8 md:w-12 md:h-12 object-cover rounded-lg border border-white/10 group-hover:border-red-600 transition-all shadow-lg" title={p.nickname} />
                          <div className="absolute -top-1 -right-1 bg-red-600 text-[6px] font-black p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">GOL</div>
                        </button>
                      ))}
                    </div>
                    <div className="relative group">
                      <span className="text-8xl md:text-9xl font-oswald font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{score.left}</span>
                      <button onClick={() => setShowEventModal({ type: 'GOL', side: 'left' })} className="absolute -right-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-white text-black font-black text-xl rounded-xl hover:bg-neutral-200 transition-all active:scale-90 shadow-xl">+</button>
                    </div>
                  </div>

                  <div className="text-4xl font-oswald font-black text-gold italic opacity-50 select-none self-center">VS</div>

                  {/* RIGHT TEAM TACTICAL */}
                  <div className="flex flex-col items-center flex-1 space-y-4">
                    <div className="flex flex-wrap justify-center gap-2 max-w-[200px]">
                      {teams![activeTeams.right].map((p, i) => (
                        <button
                          key={i}
                          onClick={() => handleRegisterGoal(p, null, 'right')}
                          className="group relative"
                        >
                          <img src={p.photo} className="w-8 h-8 md:w-12 md:h-12 object-cover rounded-lg border border-white/10 group-hover:border-red-600 transition-all shadow-lg" title={p.nickname} />
                          <div className="absolute -top-1 -right-1 bg-red-600 text-[6px] font-black p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">GOL</div>
                        </button>
                      ))}
                    </div>
                    <div className="relative group">
                      <span className="text-8xl md:text-9xl font-oswald font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{score.right}</span>
                      <button onClick={() => setShowEventModal({ type: 'GOL', side: 'right' })} className="absolute -left-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-white text-black font-black text-xl rounded-xl hover:bg-neutral-200 transition-all active:scale-90 shadow-xl">+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'CANETA', label: '🥢 CANETA', type: 'CANETA' },
                  { id: 'CHAPEU', label: '👒 CHAPÉU', type: 'CHAPÉU' },
                  { id: 'FRANGO', label: '🐔 FRANGO', type: 'FRANGO' },
                  { id: 'FURADA', label: '👟 FURADA', type: 'FURADA' },
                  { id: 'ARREGO', label: '🏳️ ARREGO', type: 'ARREGO' }
                ].map(evt => (
                  <button
                    key={evt.id}
                    onClick={() => setShowEventModal({ type: evt.type as any })}
                    className="p-3 bg-neutral-900 border border-neutral-800 hover:border-red-600 transition-all text-neutral-500 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-90"
                  >
                    <span className="text-lg">{evt.label.split(' ')[0]}</span>
                    <span className="text-[8px] font-black">{evt.label.split(' ')[1]}</span>
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
                    if (confirm('Encerrar a partida e limpar os dados do jogo?')) {
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
                      alert("Partida encerrada! Até o próximo jogo do Balaio. ⚽");
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
