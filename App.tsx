
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
import NewsPortal from './components/NewsPortal';
import Logo from './components/Logo';
import AccessibilityControl from './components/AccessibilityControl';
import { supabase } from './services/supabaseClient';
import { ADMIN_NICKNAMES } from './constants';
import { CLUB } from './brandConfig';

function App() {
  const [isLogged, setIsLogged] = useState(() => {
    return localStorage.getItem('fdp_is_logged') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'partida' | 'resenha' | 'admin' | 'financeiro' | 'votacao' | 'noticias'>(() => {
    return (localStorage.getItem('fdp_active_tab') as any) || 'dashboard';
  });
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [finances, setFinances] = useState<GlobalFinances | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [trainingConfirmedIds, setTrainingConfirmedIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);

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
    try {
      const { data, error } = await supabase.from('players').select('*');
      if (error) throw error;
      if (data) {
        const formatted = data.map(p => ({
          ...p,
          badges: (() => {
            try {
              return typeof p.badges === 'string' ? JSON.parse(p.badges) : (p.badges || []);
            } catch (e) { return []; }
          })(),
          matchesPlayed: p.matches_played,
          bestVotes: p.best_votes,
          worstVotes: p.worst_votes,
          moralScore: p.moral_score,
          specialEvents: p.special_events || [],
          heritage: p.heritage || [],
          thought: p.thought,
          is_admin: p.is_admin ||
            ADMIN_NICKNAMES.includes(p.nickname?.toLowerCase() || ''),
          photo: p.photo,
          isPaid: p.is_paid,
          high_badges: (() => {
            try {
              return typeof p.high_badges === 'string' ? JSON.parse(p.high_badges) : (p.high_badges || []);
            } catch (e) { return []; }
          })(),
        }));
        const filtered = formatted.filter(p => p.nickname !== 'AdminVantablack');
        setAllPlayers(filtered);
      }
    } catch (err) {
      console.error("ERRO AO CARREGAR JOGADORES:", err);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      if (data) {
        // Lógica de Votagem Automática
        const now = new Date();
        const currentDay = now.getDay(); // 0-6 (Dom-Sab)
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const matchDay = data.match_day ?? 1; // Segunda-feira
        const manualStatus = data.manual_voting_status || 'auto';

        let isVotingOpen = data.status === 'votacao_aberta';

        if (manualStatus === 'open') {
          isVotingOpen = true;
        } else if (manualStatus === 'closed') {
          isVotingOpen = false;
        } else {
          // MODO AUTO: Abre Segunda-feira (1) entre 21:00 e 23:59
          const isMonday = currentDay === 1;
          const isTimeMatch = currentHour >= 21 && currentHour <= 23;
          isVotingOpen = isVotingOpen || (isMonday && isTimeMatch);
        }

        setCurrentSession({
          ...data,
          status: data.status as any,
          playersPresent: data.players_present || [],
          votingOpen: isVotingOpen,
          matchDay: data.match_day,
          manualVotingStatus: data.manual_voting_status
        });
      } else {
        console.warn("SESSÃO ID 1 NÃO ENCONTRADA NO BANCO");
      }
    } catch (err) {
      console.error("ERRO AO CARREGAR SESSÃO:", err);
    }
  };

  const fetchFinances = async () => {
    try {
      const { data, error } = await supabase.from('finances').select('*').eq('id', 1).single();
      if (error) throw error;
      if (data) setFinances(data);
    } catch (err) {
      console.error("ERRO AO CARREGAR FINANÇAS:", err);
    }
  };

  // 3. Restaurar Sessão Unificado
  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setIsLoading(true);
      setLoadError(false);

      // Safety timeout: se após 5s ainda não carregou, desbloqueia o app SEM destruir sessão
      const safetyTimeout = setTimeout(() => {
        if (!isMounted) return;
        console.error('TIMEOUT: load demorou +5s. Desbloqueando app...');
        setLoadError(true);
        setIsLoading(false);
      }, 5000);

      try {
        // 1. Carregar dados básicos
        await Promise.allSettled([
          fetchPlayers(),
          fetchCurrentSession(),
          fetchFinances()
        ]);

        // 2. Tentar restaurar usuário se estiver marcado como logado
        const savedIsLogged = localStorage.getItem('fdp_is_logged') === 'true';
        const savedUserId = localStorage.getItem('fdp_user');

        if (savedIsLogged && savedUserId) {
          const { data: userData, error: userError } = await supabase
            .from('players')
            .select('*')
            .eq('id', savedUserId)
            .maybeSingle();

          if (userData && !userError) {
            const formatted = {
              ...userData,
              badges: (() => {
                try {
                  return typeof userData.badges === 'string' ? JSON.parse(userData.badges) : (userData.badges || []);
                } catch (e) { return []; }
              })(),
              matchesPlayed: userData.matches_played,
              bestVotes: userData.best_votes,
              worstVotes: userData.worst_votes,
              moralScore: userData.moral_score,
              is_admin: userData.is_admin || ADMIN_NICKNAMES.includes(userData.nickname?.toLowerCase() || ''),
              photo: userData.photo,
              isPaid: userData.is_paid,
              high_badges: (() => {
                try {
                  return typeof userData.high_badges === 'string' ? JSON.parse(userData.high_badges) : (userData.high_badges || []);
                } catch (e) { return []; }
              })(),
            };
            if (isMounted) {
              setCurrentUser(formatted);
              setIsLogged(true);
            }
          } else {
            // Usuário não encontrado no banco — limpa sessão corrompida
            if (isMounted) handleLogout();
          }
        }
      } catch (err) {
        console.error('ERRO NO LOAD_ALL:', err);
        if (isMounted) setLoadError(true);
        // NÃO faz logout automático — permite retry sem destruir sessão
      } finally {
        clearTimeout(safetyTimeout);
        if (isMounted) setIsLoading(false);
      }
    };
    loadAll();
    return () => { isMounted = false; };
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
        alert("Você já votou nesta rodada, parceiro! Um voto por sócio.");
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
    localStorage.setItem('fdp_user', player.id); // Guardar apenas o ID para consistência
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

  // Só sai da tela de carregamento quando os dados e a sessão (se logado) estiverem prontos
  if (isLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center">
        <img src="/escudo.svg" alt="Balaio de Gato FC" width={96} height={96} style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 16, filter: 'drop-shadow(0 0 24px rgba(245,197,24,.35))' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <div style={{ width: 64, height: 64, border: '4px solid #F5C518', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p style={{ color: '#F5C518', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '0.4em', fontSize: 14 }} className="font-oswald text-gold uppercase italic tracking-[0.4em] animate-pulse">
          Balaio de Gato FC
        </p>
        {loadError && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em' }} className="text-red-500 font-mono text-xs uppercase tracking-widest">
              Erro de conexão.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 12, padding: '10px 24px', background: '#F5C518', color: '#000', border: 'none', borderRadius: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', fontSize: 12, letterSpacing: '0.2em' }}
            >
              TENTAR DE NOVO
            </button>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-900 flex flex-col md:flex-row">

      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-neutral-900/40 border-r border-gold/10 backdrop-blur-2xl sticky top-0 h-screen z-50">
        <div className="p-6 border-b border-gold/10">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
            <Logo size={44} className="group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(245,197,24,0.4)]" />
            <h1 className="font-oswald text-2xl font-black tracking-tighter uppercase italic leading-tight">
              BALAIO <br />
              <span className="text-gold text-lg">DE GATO FC</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
          <SideButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="📊" label="Ranking Geral" />
          <SideButton active={activeTab === 'noticias'} onClick={() => setActiveTab('noticias')} icon="📰" label="Notícias do Clube" />
          <SideButton active={activeTab === 'partida'} onClick={() => setActiveTab('partida')} icon="🏟️" label="Dia de Jogo" />
          <SideButton
            active={activeTab === 'votacao'}
            onClick={() => setActiveTab('votacao')}
            icon="🗳️"
            label="Centro de Votação"
            urgent={currentSession?.votingOpen}
          />
          <SideButton active={activeTab === 'resenha'} onClick={() => setActiveTab('resenha')} icon="🏆" label="Mural da Resenha" />
          <SideButton active={activeTab === 'financeiro'} onClick={() => setActiveTab('financeiro')} icon="💸" label="Tesouraria" />

          <div className="pt-8 pb-2">
            <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.3em] px-4 mb-2">Diretoria</p>
            <SideButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" label="Painel da Diretoria" color="text-gold" />
          </div>
        </nav>

        <div className="px-6 pb-2">
          <AccessibilityControl />
        </div>

        {isLogged && currentUser && (
          <div className="px-6 pb-4">
            <NotificationCenter currentUser={currentUser} />
          </div>
        )}

        {isLogged && (
          <div className="p-4 border-t border-gold/10 bg-neutral-900/20">
            <div className="flex items-center gap-3 p-2 rounded-xl border border-gold/10 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setSelectedPlayer(currentUser)}>
              <img src={currentUser?.photo} className="w-10 h-10 rounded-full border border-gold/40 object-cover" alt="Perfil" />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black truncate uppercase">{currentUser?.nickname}</p>
                <p className="text-[10px] text-neutral-500 font-mono">Ver Perfil</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full mt-3 text-[10px] font-mono text-neutral-600 uppercase font-black hover:text-gold transition-colors py-2">Sair</button>
          </div>
        )}
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden glass-panel border-b border-neutral-800/50 p-4 sticky top-0 z-50 flex justify-between items-center h-16">
        <div className="flex items-center gap-2">
          {selectedPlayer ? (
            <button
              onClick={() => setSelectedPlayer(null)}
              className="flex items-center gap-2 bg-gradient-to-r from-gold-700 to-gold text-black px-4 py-2 rounded-xl font-oswald font-black uppercase italic text-xs shadow-[0_4px_15px_rgba(245,197,24,0.35)] active:scale-95 transition-all"
            >
              <span className="text-lg">←</span> VOLTAR
            </button>
          ) : (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <Logo size={30} />
              <h1 className="font-oswald text-lg font-black uppercase italic text-gold">BALAIO <span className="text-white">FC</span></h1>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AccessibilityControl compact />
          {isLogged && currentUser && <NotificationCenter currentUser={currentUser} />}
          {isLogged ? (
            <img
              src={currentUser?.photo}
              className="w-8 h-8 rounded-full border border-gold/60 shadow-[0_0_10px_rgba(245,197,24,0.25)] object-cover"
              alt="Perfil"
              onClick={() => setSelectedPlayer(currentUser)}
            />
          ) : (
            <button
              onClick={() => setActiveTab('resenha')}
              className="bg-gold text-black px-3 py-1.5 font-oswald font-bold uppercase italic text-[10px] border border-gold-700 rounded"
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
                className="w-full mb-8 py-4 bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 rounded-2xl flex items-center justify-center gap-3 group shadow-2xl hover:border-gold/50 transition-all active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-black font-black group-hover:scale-110 transition-transform">←</div>
                <div className="text-left">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest leading-none mb-1">Voltar</p>
                  <p className="text-sm font-oswald font-black text-white uppercase italic tracking-tighter leading-none">VOLTAR PARA O {activeTab === 'dashboard' ? 'RANKING' : activeTab.toUpperCase()}</p>
                </div>
              </button>
              <PlayerProfile player={selectedPlayer} currentUser={currentUser} />
            </div>
          ) : (
            <div className="animate-slide-up">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* HERO DO CLUBE — visual de campo de futebol */}
                  <div className="relative overflow-hidden rounded-[32px] border border-gold/20 mb-8 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-pitch-700 via-pitch-900 to-black"></div>
                    {/* faixas do gramado */}
                    <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ffffff 0 70px, transparent 70px 140px)' }}></div>
                    {/* marcações do campo */}
                    <div className="absolute -right-20 -bottom-24 w-72 h-72 rounded-full border-[3px] border-white/15"></div>
                    <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full border-[3px] border-white/10"></div>
                    <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/10 hidden md:block"></div>

                    <div className="relative z-10 p-6 md:p-10 flex flex-col sm:flex-row items-center gap-5 md:gap-8 text-center sm:text-left">
                      <Logo size={100} className="drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] shrink-0" />
                      <div>
                        <p className="text-[10px] md:text-xs font-mono text-gold uppercase tracking-[0.4em] mb-2">Futebol de Campo • Cariacica-ES</p>
                        <h2 className="font-oswald text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white leading-none">
                          Balaio de Gato <span className="text-gold">FC</span>
                        </h2>
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                          <span className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-white text-xs font-bold">🏆 Temporada {new Date().getFullYear()}</span>
                          <span className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-white text-xs font-bold">👥 {allPlayers.length} sócios</span>
                          <span className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-white text-xs font-bold">⚽ {allPlayers.reduce((a, p) => a + (p.goals || 0), 0)} gols na temporada</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Rankings players={allPlayers} onPlayerClick={setSelectedPlayer} />
                </div>
              )}
              {/* Notícias do clube: público (não exige login) */}
              {activeTab === 'noticias' && (
                <div className="animate-slide-up pt-4">
                  <NewsPortal currentUser={currentUser} />
                </div>
              )}
              {/* Proteção para abas de Jogador */}
              {!isLogged && activeTab !== 'dashboard' && activeTab !== 'noticias' ? (
                <div className="max-w-md mx-auto mt-12">
                  <LoginScreen onLogin={handleLogin} />
                </div>
              ) : (
                <div key={activeTab} className="animate-slide-up pt-4">
                  {/* Dashboard rendered above for non-logged users as well */}
                  {activeTab === 'partida' && currentUser && (
                    <MatchControl
                      players={allPlayers}
                      currentUser={currentUser}
                      currentSession={currentSession}
                      isTrainingMode={isTrainingMode}
                      trainingConfirmedIds={trainingConfirmedIds}
                      setTrainingConfirmedIds={setTrainingConfirmedIds}
                    />
                  )}
                  {activeTab === 'resenha' && currentUser && <ChatResenha currentUser={currentUser} allPlayers={allPlayers} />}
                  {activeTab === 'financeiro' && currentUser && <Caixinha players={allPlayers} finances={finances} currentUser={currentUser} />}
                  {activeTab === 'votacao' && currentUser && <PostMatchVoting players={allPlayers} onSubmit={handleApplyVotes} currentUser={currentUser} currentSession={currentSession} />}
                  {activeTab === 'admin' && currentUser && (
                    currentUser.is_admin ? (
                      <AdminPanel
                        players={allPlayers}
                        currentSession={currentSession!}
                        finances={finances!}
                        onUpdateFinances={fetchFinances}
                        onUpdatePlayer={fetchPlayers}
                        onUpdateSession={fetchCurrentSession}
                        isTrainingMode={isTrainingMode}
                        setIsTrainingMode={setIsTrainingMode}
                        setTrainingConfirmedIds={setTrainingConfirmedIds}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 glass-panel border-gold/20 rounded-3xl mt-12">
                        <span className="text-6xl filter drop-shadow-[0_0_15px_rgba(245,197,24,0.5)]">🔒</span>
                        <h2 className="text-4xl font-oswald font-black text-gold uppercase italic">Área da Diretoria</h2>
                        <p className="max-w-md text-neutral-500 font-mono text-xs uppercase tracking-widest leading-relaxed">
                          Este painel é exclusivo da diretoria do Balaio de Gato FC. Fala com um diretor pra liberar seu acesso.
                        </p>
                        <button
                          onClick={() => setActiveTab('dashboard')}
                          className="bg-gold text-black px-8 py-3 font-oswald font-black uppercase text-sm hover:bg-gold-600 transition-all border-b-4 border-gold-700 active:translate-y-1 active:border-b-0"
                        >
                          Voltar para o Ranking
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
          <NavButton active={activeTab === 'noticias'} onClick={() => setActiveTab('noticias')} icon="📰" label="News" />
          <NavButton active={activeTab === 'partida'} onClick={() => setActiveTab('partida')} icon="🏟️" label="Jogo" />
          <NavButton
            active={activeTab === 'votacao'}
            onClick={() => setActiveTab('votacao')}
            icon="🗳️"
            label="Voto"
            urgent={currentSession?.votingOpen}
          />
          <NavButton active={activeTab === 'resenha'} onClick={() => setActiveTab('resenha')} icon="🏆" label="Resenha" />
          <NavButton active={activeTab === 'financeiro'} onClick={() => setActiveTab('financeiro')} icon="💸" label="Caixa" />
          {currentUser?.is_admin && <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" label="Diretoria" color="text-gold" />}
        </div>
      </nav>
    </div>
  );
}

function SideButton({ active, onClick, icon, label, urgent = false, color = "text-white" }: { active: boolean, onClick: () => void, icon: string, label: string, urgent?: boolean, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all relative group ${active ? 'bg-gold text-black shadow-[0_0_20px_rgba(245,197,24,0.25)]' : 'text-neutral-500 hover:text-white hover:bg-neutral-800/50'}`}
    >
      <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-black' : color}`}>{label}</span>

      {urgent && (
        <span className="flex h-2 w-2 absolute right-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pitch-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-pitch-500"></span>
        </span>
      )}

      {active && <div className="absolute right-0 w-1 h-8 bg-black rounded-l-full"></div>}
    </button>
  );
}

function NavButton({ active, onClick, icon, label, urgent = false, color = "text-white" }: { active: boolean, onClick: () => void, icon: string, label: string, urgent?: boolean, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all relative ${active ? 'bg-gold text-black scale-110 -translate-y-2' : 'text-neutral-500 opacity-60'}`}
    >
      {urgent && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pitch-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-pitch-500 border border-black"></span>
        </span>
      )}
      <span className="text-xl">{icon}</span>
      <span className={`text-[7px] font-black uppercase mt-1 ${active ? 'text-black' : color}`}>{label}</span>
      {active && (
        <div className="absolute -bottom-4 w-1.5 h-1.5 bg-gold rounded-full"></div>
      )}
    </button>
  );
}

export default App;
