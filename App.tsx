
import React, { useState, useEffect } from 'react';
import { Player, MatchSession, Position, PlayerStatus, GlobalFinances, FinancialGoal } from './types';
import LoginScreen from './components/LoginScreen';
import NotificationCenter from './components/NotificationCenter';
import Rankings from './components/Rankings';
import MatchControl from './components/MatchControl';
import ChatResenha from './components/ChatResenha';
import AdminPanel from './components/AdminPanel';
import Caixinha from './components/Caixinha';
import PostMatchVoting from './components/PostMatchVoting';
import PlayerProfile from './components/PlayerProfile';
import { isLastMondayOfMonth, supabase } from './services/supabaseClient';
import { aiService } from './services/geminiService';
import { ADMIN_NICKNAMES } from './constants';

function App() {
  const [isLogged, setIsLogged] = useState(() => {
    return localStorage.getItem('fdp_is_logged') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<Player | null>(() => {
    const saved = localStorage.getItem('fdp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'partida' | 'resenha' | 'admin' | 'financeiro' | 'votacao'>(() => {
    return (localStorage.getItem('fdp_active_tab') as any) || 'dashboard';
  });
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [finances, setFinances] = useState<GlobalFinances | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Carregar Dados do Supabase
  useEffect(() => {
    // Inscrição em tempo real para Jogadores
    const playersSub = supabase
      .channel('public:players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers();
      })
      .subscribe();

    // Inscrição em tempo real para Sessão
    const sessionSub = supabase
      .channel('public:sessions')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, () => {
        fetchCurrentSession();
      })
      .subscribe();

    const financesSub = supabase
      .channel('public:finances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, () => {
        fetchFinances();
      })
      .subscribe();

    return () => {
      playersSub.unsubscribe();
      sessionSub.unsubscribe();
      financesSub.unsubscribe();
    };
  }, []);

  // 2. Persistir Aba Ativa
  useEffect(() => {
    localStorage.setItem('fdp_active_tab', activeTab);
  }, [activeTab]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase.from('players').select('*');
    if (data) {
      const formatted = data.map(p => ({
        ...p,
        badges: typeof p.badges === 'string' ? JSON.parse(p.badges) : p.badges,
        matchesPlayed: p.matches_played,
        bestVotes: p.best_votes,
        worstVotes: p.worst_votes,
        moralScore: p.moral_score,
        specialEvents: p.special_events || [],
        heritage: p.heritage || [],
        thought: p.thought,
        is_admin: p.is_admin ||
          ADMIN_NICKNAMES.includes(p.nickname?.toLowerCase() || ''),
        isPaid: p.is_paid,
        high_badges: typeof p.high_badges === 'string' ? JSON.parse(p.high_badges) : p.high_badges,
      }));
      const filtered = formatted.filter(p => p.nickname !== 'AdminVantablack');
      setAllPlayers(filtered);
    }
  };

  const fetchCurrentSession = async () => {
    const { data, error } = await supabase.from('sessions').select('*').eq('id', 1).single();
    if (data) {
      // Lógica de Votagem Automática
      const now = new Date();
      const currentDay = now.getDay(); // 0-6 (Dom-Sab)
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const matchDay = data.match_day ?? 1; // Segunda-feira
      const manualStatus = data.manual_voting_status || 'auto';

      let isVotingOpen = false;

      if (manualStatus === 'open') {
        isVotingOpen = true;
      } else if (manualStatus === 'closed') {
        isVotingOpen = false;
      } else {
        // MODO AUTO: Abre Segunda-feira (1) entre 21:00 e 23:59
        const isMonday = currentDay === 1;
        const isTimeMatch = currentHour >= 21 && currentHour <= 23;
        isVotingOpen = isMonday && isTimeMatch;
      }

      // Se o status calculado for diferente do banco e for AUTO, atualizamos (opcional para consistência visual)

      setCurrentSession({
        ...data,
        status: data.status as any,
        playersPresent: data.players_present || [],
        votingOpen: isVotingOpen,
        manualVotingStatus: data.manual_voting_status
      });
    }
  };

  const fetchFinances = async () => {
    const { data, error } = await supabase.from('finances').select('*').eq('id', 1).single();
    if (data) setFinances(data);
  };

  // Carregamento inicial unificado
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchPlayers(),
        fetchCurrentSession(),
        fetchFinances()
      ]);
      setIsLoading(false);
    };
    loadAll();
  }, []);

  const handleApplyVotes = async (bestId: string, worstId: string) => {
    if (!currentUser) return;

    try {
      // Unificar lógica de Match ID: Sempre a última segunda-feira RELATIVA AO DIA LOCAL
      const now = new Date();
      const matchDay = currentSession?.match_day ?? 1;
      const lastMatch = new Date(now);
      const diff = (now.getDay() - matchDay + 7) % 7;
      lastMatch.setDate(now.getDate() - diff);

      // Gerar string de data LOCAL (YYYY-MM-DD)
      const year = lastMatch.getFullYear();
      const month = String(lastMatch.getMonth() + 1).padStart(2, '0');
      const day = String(lastMatch.getDate()).padStart(2, '0');
      const matchId = `${year}-${month}-${day}`;

      const { error: vError } = await supabase.from('votes').insert([{
        voter_nickname: currentUser.nickname,
        match_id: matchId,
        best_voted_id: bestId,
        worst_voted_id: worstId
      }]);

      if (vError) {
        alert("VOCÊ JÁ VOTOU ESSA SEMANA, VAGABUNDO! Trapaça aqui não.");
        setActiveTab('dashboard');
        return;
      }

      // 2. Atualizar Stats dos Jogadores (Incr/Decr Moral)
      // Nota: Idealmente isso seria uma RPC ou Trigger, mas faremos via update simples pra rapidez
      const bestPlayer = allPlayers.find(p => p.id === bestId);
      const worstPlayer = allPlayers.find(p => p.id === worstId);

      if (bestPlayer) {
        await supabase.from('players').update({
          best_votes: (bestPlayer.bestVotes || 0) + 1,
          moral_score: Math.min(100, (bestPlayer.moralScore || 0) + 5)
        }).eq('id', bestId);
      }

      if (worstPlayer) {
        await supabase.from('players').update({
          worst_votes: (worstPlayer.worstVotes || 0) + 1,
          moral_score: Math.max(0, (worstPlayer.moralScore || 0) - 5)
        }).eq('id', worstId);
      }

      setActiveTab('dashboard');
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = (player: Player) => {
    setCurrentUser(player);
    setIsLogged(true);
    localStorage.setItem('fdp_user', JSON.stringify(player));
    localStorage.setItem('fdp_is_logged', 'true');
  };

  const handleLogout = () => {
    setIsLogged(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
    localStorage.removeItem('fdp_user');
    localStorage.removeItem('fdp_is_logged');
    localStorage.removeItem('fdp_active_tab');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-oswald text-white uppercase italic tracking-[0.4em] animate-pulse">Iniciando Protocolo Vantablack...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-900 flex flex-col md:flex-row">

      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-neutral-900/40 border-r border-neutral-800/50 backdrop-blur-2xl sticky top-0 h-screen z-50">
        <div className="p-6 border-b border-neutral-800/50">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
            <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,0,0,0.5)] group-hover:scale-110 transition-transform">⚽</span>
            <h1 className="font-oswald text-2xl font-black tracking-tighter uppercase italic leading-tight">
              FDP <br />
              <span className="text-red-600 text-lg">PERNAS DE PAU</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
          <SideButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="📊" label="Ranking Geral" />
          <SideButton active={activeTab === 'partida'} onClick={() => setActiveTab('partida')} icon="🏟️" label="Controle de Pelada" />
          <SideButton
            active={activeTab === 'votacao'}
            onClick={() => setActiveTab('votacao')}
            icon="🗳️"
            label="Centro de Votação"
            urgent={currentSession?.votingOpen}
          />
          <SideButton active={activeTab === 'resenha'} onClick={() => setActiveTab('resenha')} icon="🏆" label="Mural de Feitos" />
          <SideButton active={activeTab === 'financeiro'} onClick={() => setActiveTab('financeiro')} icon="💸" label="Caixa da Pelada" />

          <div className="pt-8 pb-2">
            <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.3em] px-4 mb-2">Comando</p>
            <SideButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" label="Painel de Admin" color="text-red-600" />
          </div>
        </nav>

        {isLogged && currentUser && (
          <div className="px-6 pb-4">
            <NotificationCenter currentUser={currentUser} />
          </div>
        )}

        {isLogged && (
          <div className="p-4 border-t border-neutral-800/50 bg-neutral-900/20">
            <div className="flex items-center gap-3 p-2 rounded-xl border border-neutral-800/30 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setSelectedPlayer(currentUser)}>
              <img src={currentUser?.photo} className="w-10 h-10 rounded-full border border-red-900/50 object-cover" alt="Perfil" />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black truncate uppercase">{currentUser?.nickname}</p>
                <p className="text-[10px] text-neutral-500 font-mono">Ver Perfil</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full mt-3 text-[10px] font-mono text-neutral-600 uppercase font-black hover:text-red-500 transition-colors py-2">Fugir (Sair)</button>
          </div>
        )}
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden glass-panel border-b border-neutral-800/50 p-4 sticky top-0 z-50 flex justify-between items-center h-16">
        <div className="flex items-center gap-2">
          {selectedPlayer ? (
            <button
              onClick={() => setSelectedPlayer(null)}
              className="flex items-center gap-2 bg-gradient-to-r from-red-800 to-red-600 text-white px-4 py-2 rounded-xl font-oswald font-black uppercase italic text-xs shadow-[0_4px_15px_rgba(220,38,38,0.4)] active:scale-95 transition-all"
            >
              <span className="text-lg">←</span> VOLTAR
            </button>
          ) : (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <span className="text-xl">⚽</span>
              <h1 className="font-oswald text-lg font-black uppercase italic text-red-600">FDP <span className="text-white">FUT</span></h1>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isLogged && currentUser && <NotificationCenter currentUser={currentUser} />}
          {isLogged ? (
            <img
              src={currentUser?.photo}
              className="w-8 h-8 rounded-full border border-red-900 shadow-[0_0_10px_rgba(185,28,28,0.3)] object-cover"
              alt="Perfil"
              onClick={() => setSelectedPlayer(currentUser)}
            />
          ) : (
            <button
              onClick={() => setActiveTab('resenha')}
              className="bg-red-700 text-white px-3 py-1.5 font-oswald font-bold uppercase italic text-[10px] border border-red-900 rounded"
            >Entrar</button>
          )}
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="flex-1 relative pb-24 md:pb-8 overflow-x-hidden">
        <div className="page-container py-6 min-h-full">
          {selectedPlayer ? (
            <div className="animate-slide-up">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="w-full mb-8 py-4 bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 rounded-2xl flex items-center justify-center gap-3 group shadow-2xl hover:border-red-600/50 transition-all active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-black group-hover:scale-110 transition-transform">←</div>
                <div className="text-left">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest leading-none mb-1">Cansou de ver esse aqui?</p>
                  <p className="text-sm font-oswald font-black text-white uppercase italic tracking-tighter leading-none">VOLTAR PARA O {activeTab === 'dashboard' ? 'RANKING' : activeTab.toUpperCase()}</p>
                </div>
              </button>
              <PlayerProfile player={selectedPlayer} currentUser={currentUser} />
            </div>
          ) : (
            <div className="animate-slide-up">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="mb-8">
                    <h2 className="section-title text-3xl md:text-5xl mb-2">Mural do <span className="text-red-600">Orgulho</span></h2>
                    <p className="text-neutral-500 font-mono text-[9px] md:text-xs uppercase tracking-[0.4em]">Temporada Pro • Live Status</p>
                  </div>
                  <Rankings players={allPlayers} onPlayerClick={setSelectedPlayer} />
                </div>
              )}
              {/* Proteção para abas de Jogador */}
              {!isLogged && activeTab !== 'dashboard' ? (
                <div className="max-w-md mx-auto mt-12">
                  <LoginScreen onLogin={handleLogin} />
                </div>
              ) : (
                <div key={activeTab} className="animate-slide-up pt-4">
                  {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                      <div className="mb-8">
                        <h2 className="section-title text-3xl md:text-5xl mb-2">Mural do <span className="text-red-600">Orgulho</span></h2>
                        <p className="text-neutral-500 font-mono text-[9px] md:text-xs uppercase tracking-[0.4em]">Temporada Pro • Live Status</p>
                      </div>
                      <Rankings players={allPlayers} onPlayerClick={setSelectedPlayer} />
                    </div>
                  )}
                  {activeTab === 'partida' && currentSession && <MatchControl players={allPlayers} currentUser={currentUser!} currentSession={currentSession} />}
                  {activeTab === 'resenha' && <ChatResenha currentUser={currentUser!} allPlayers={allPlayers} />}
                  {activeTab === 'financeiro' && <Caixinha players={allPlayers} finances={finances!} currentUser={currentUser!} />}
                  {activeTab === 'votacao' && <PostMatchVoting players={allPlayers} onSubmit={handleApplyVotes} currentUser={currentUser!} currentSession={currentSession!} />}
                  {activeTab === 'admin' && (
                    currentUser?.is_admin ? (
                      <AdminPanel
                        players={allPlayers}
                        currentSession={currentSession!}
                        finances={finances!}
                        onUpdateFinances={fetchFinances}
                        onUpdatePlayer={fetchPlayers}
                        onUpdateSession={fetchCurrentSession}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 glass-panel border-red-900/30 rounded-3xl mt-12">
                        <span className="text-6xl filter drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]">🚫</span>
                        <h2 className="text-4xl font-oswald font-black text-red-600 uppercase italic">Acesso Negado</h2>
                        <p className="max-w-md text-neutral-500 font-mono text-xs uppercase tracking-widest leading-relaxed">
                          Área restrita aos administradores do bueiro. Sai daqui antes que eu te dê um rapa.
                        </p>
                        <button
                          onClick={() => setActiveTab('dashboard')}
                          className="bg-white text-black px-8 py-3 font-oswald font-black uppercase text-sm hover:bg-neutral-200 transition-all border-b-4 border-neutral-400 active:translate-y-1 active:border-b-0"
                        >
                          Voltar para o Rank
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MOBILE NAVIGATION (Polished) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/5 p-2 px-4 z-50 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        <div className="flex justify-between items-center max-w-lg mx-auto h-16">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="📊" label="Rank" />
          <NavButton active={activeTab === 'partida'} onClick={() => setActiveTab('partida')} icon="🏟️" label="Pelada" />
          <NavButton
            active={activeTab === 'votacao'}
            onClick={() => setActiveTab('votacao')}
            icon="🗳️"
            label="Voto"
            urgent={currentSession?.votingOpen}
          />
          <NavButton active={activeTab === 'resenha'} onClick={() => setActiveTab('resenha')} icon="🏆" label="FEITOS" />
          <NavButton active={activeTab === 'financeiro'} onClick={() => setActiveTab('financeiro')} icon="💸" label="Caixa" />
          {currentUser?.is_admin && <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" label="Admin" color="text-red-500" />}
        </div>
      </nav>
    </div>
  );
}

function SideButton({ active, onClick, icon, label, urgent = false, color = "text-white" }: { active: boolean, onClick: () => void, icon: string, label: string, urgent?: boolean, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all relative group ${active ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'text-neutral-500 hover:text-white hover:bg-neutral-800/50'}`}
    >
      <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-white' : color}`}>{label}</span>

      {urgent && (
        <span className="flex h-2 w-2 absolute right-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}

      {active && <div className="absolute right-0 w-1 h-8 bg-white rounded-l-full"></div>}
    </button>
  );
}

function NavButton({ active, onClick, icon, label, urgent = false, color = "text-white" }: { active: boolean, onClick: () => void, icon: string, label: string, urgent?: boolean, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all relative ${active ? 'bg-red-600 text-white scale-110 -translate-y-2' : 'text-neutral-500 opacity-60'}`}
    >
      {urgent && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black"></span>
        </span>
      )}
      <span className="text-xl">{icon}</span>
      <span className={`text-[7px] font-black uppercase mt-1 ${active ? 'text-white' : color}`}>{label}</span>
      {active && (
        <div className="absolute -bottom-4 w-1.5 h-1.5 bg-red-600 rounded-full"></div>
      )}
    </button>
  );
}

export default App;
