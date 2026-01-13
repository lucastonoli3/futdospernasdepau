
import React, { useState, useEffect } from 'react';
import { Player, MatchSession, Position, PlayerStatus, GlobalFinances, FinancialGoal } from './types';
import LoginScreen from './components/LoginScreen';
import Rankings from './components/Rankings';
import MatchControl from './components/MatchControl';
import ChatResenha from './components/ChatResenha';
import AdminPanel from './components/AdminPanel';
import Caixinha from './components/Caixinha';
import PostMatchVoting from './components/PostMatchVoting';
import PlayerProfile from './components/PlayerProfile';
import { isLastMondayOfMonth, supabase } from './services/supabaseClient';
import { aiService } from './services/geminiService';

function App() {
  const [isLogged, setIsLogged] = useState(false);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'partida' | 'resenha' | 'admin' | 'financeiro' | 'votacao'>('dashboard');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [finances, setFinances] = useState<GlobalFinances | null>(null);

  // 1. Carregar Dados do Supabase
  useEffect(() => {
    fetchPlayers();
    fetchSession();

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
        fetchSession();
      })
      .subscribe();

    const financesSub = supabase
      .channel('public:finances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, () => {
        fetchFinances();
      })
      .subscribe();

    fetchFinances();

    return () => {
      playersSub.unsubscribe();
      sessionSub.unsubscribe();
      financesSub.unsubscribe();
    };
  }, []);

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
        is_admin: p.is_admin || p.nickname?.toLowerCase() === 'tonoli',
        isPaid: p.is_paid,
        high_badges: typeof p.high_badges === 'string' ? JSON.parse(p.high_badges) : p.high_badges,
      }));
      const filtered = formatted.filter(p => p.nickname !== 'AdminVantablack');
      setAllPlayers(filtered);
    }
  };

  const fetchSession = async () => {
    const { data, error } = await supabase.from('sessions').select('*').eq('id', 1).single();
    if (data) {
      // Lógica de Votagem Automática
      const now = new Date();
      const currentDay = now.getDay(); // 0-6 (Dom-Sab)
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const matchDay = data.match_day ?? 1; // Default Segunda
      const manualStatus = data.manual_voting_status ?? 'auto';

      let isVotingOpen = data.voting_open;

      if (manualStatus === 'open') {
        isVotingOpen = true;
      } else if (manualStatus === 'closed') {
        isVotingOpen = false;
      } else {
        // Modo AUTO: Fecha as 23:59 do dia da pelada
        // Ajuste para considerar Domingo (0) como o dia 7 para facilitar comparação se o dia passou
        const todayAdjusted = currentDay === 0 ? 7 : currentDay;
        const matchDayAdjusted = matchDay === 0 ? 7 : matchDay;

        if (todayAdjusted === matchDayAdjusted) {
          if (currentHour >= 24) { // Praticamente nunca entra aqui pois muda o dia, mas ok
            isVotingOpen = false;
          } else {
            isVotingOpen = data.voting_open;
          }
        } else if (todayAdjusted > matchDayAdjusted) {
          // Hoje é depois da pelada (ex: Pelada Segunda(1), Hoje Terça(2))
          isVotingOpen = false;
        } else {
          // Hoje é antes da pelada (ex: Pelada Segunda(1), Hoje Domingo(0/7) - Ops, wait.)
          // Se Pelada é Segunda (1) e hoje é Domingo (0), todayAdjusted=7, so 7 > 1 is true.
          // Isso ainda está errado. O ciclo deve resetar em algum momento.
          // Vamos assumir que a votação abre na Quinta(4) ou Sexta(5).
          // Se hoje é Terça(2), Quarta(3), Quinta cedo(4) -> Fechado.
          // Se a pelada foi Segunda(1), fechamos na Terça(2).
          // Então: fechado se (hoje > matchDay) e (hoje < matchDay + 4 dias de descanso)

          const daysSinceMatch = (currentDay - matchDay + 7) % 7;
          if (daysSinceMatch > 0 && daysSinceMatch < 4) {
            isVotingOpen = false;
          } else {
            isVotingOpen = data.voting_open;
          }
        }
      }

      // Se o status calculado for diferente do banco e for AUTO, atualizamos (opcional para consistência visual)

      setCurrentSession({
        status: data.status as any,
        votingOpen: isVotingOpen,
        playersPresent: data.players_present || [],
        matchDay: data.match_day,
        manualVotingStatus: data.manual_voting_status
      });
    }
  };

  const fetchFinances = async () => {
    try {
      const { data, error } = await supabase.from('finances').select('*').eq('id', 1).single();
      if (data) {
        setFinances({
          id: data.id,
          total_balance: data.total_balance,
          goals: Array.isArray(data.goals) ? data.goals : JSON.parse(data.goals || '[]')
        });
      }
    } catch (e) {
      console.warn("Finanças não encontradas ou tabela inexistente.");
    }
  };

  const handleApplyVotes = async (bestId: string, worstId: string) => {
    if (!currentUser) return;

    try {
      // 1. Registrar Voto
      const matchId = new Date().toISOString().split('T')[0];
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
  };

  const handleLogout = () => {
    setIsLogged(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-black text-white font-inter selection:bg-red-900">

      {/* Header Estilo Vantablack */}
      <header className="bg-neutral-900/50 border-b border-neutral-800 p-4 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">⚽</span>
            <h1 className="font-oswald text-xl font-bold tracking-tighter uppercase italic text-red-600">
              FDP <span className="text-white">Fut dos Pernas de Pau</span>
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-black border border-neutral-800 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Live: {allPlayers.length} Inscritos</span>
            </div>
            {isLogged ? (
              <div className="flex items-center gap-3">
                <img
                  src={currentUser?.photo}
                  className="w-10 h-10 rounded-full border-2 border-red-900 cursor-pointer hover:scale-110 transition-all outline outline-offset-2 outline-neutral-900 object-cover"
                  alt="Perfil"
                  onClick={() => setSelectedPlayer(currentUser)}
                />
                <button onClick={handleLogout} className="text-[10px] font-mono text-red-600 uppercase font-black hover:underline">Sair</button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('resenha')}
                className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 font-oswald font-bold uppercase italic text-sm border border-red-900 shadow-[0_0_15px_rgba(185,28,28,0.3)] transition-all"
              >
                Entrar / FEITOS
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="pb-24 pt-8">
        {selectedPlayer ? (
          <div className="animate-in fade-in zoom-in duration-500">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="max-w-4xl mx-auto block mb-4 text-xs font-mono text-neutral-500 hover:text-white uppercase tracking-widest pl-4"
            >
              ← Voltar para {activeTab}
            </button>
            <PlayerProfile player={selectedPlayer} currentUser={currentUser} />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {activeTab === 'dashboard' && <Rankings players={allPlayers} onPlayerClick={setSelectedPlayer} />}

            {/* Proteção para abas de Jogador */}
            {!isLogged && activeTab !== 'dashboard' ? (
              <LoginScreen onLogin={handleLogin} />
            ) : (
              <>
                {activeTab === 'partida' && currentSession && <MatchControl players={allPlayers} currentUser={currentUser!} currentSession={currentSession} />}
                {activeTab === 'resenha' && <ChatResenha currentUser={currentUser!} allPlayers={allPlayers} />}
                {activeTab === 'financeiro' && <Caixinha players={allPlayers} finances={finances!} currentUser={currentUser!} />}
                {activeTab === 'admin' && (
                  currentUser?.is_admin ? (
                    <AdminPanel
                      players={allPlayers}
                      currentSession={currentSession!}
                      finances={finances!}
                      onUpdateFinances={fetchFinances}
                      onUpdatePlayer={() => fetchPlayers()}
                      onUpdateSession={() => fetchSession()}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                      <span className="text-6xl">🚫</span>
                      <h2 className="text-4xl font-oswald font-black text-red-600 uppercase italic">Acesso Negado</h2>
                      <p className="max-w-md text-neutral-500 font-mono text-xs uppercase tracking-widest">
                        Área restrita aos administradores do bueiro. Sai daqui antes que eu te dê um rapa.
                      </p>
                      <button
                        onClick={() => setActiveTab('dashboard')}
                        className="bg-white text-black px-6 py-2 font-oswald font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all"
                      >
                        Voltar para o Rank
                      </button>
                    </div>
                  )
                )}
                {activeTab === 'votacao' && <PostMatchVoting players={allPlayers} onSubmit={handleApplyVotes} currentUser={currentUser!} currentSession={currentSession!} />}
              </>
            )}
          </div>
        )}
      </main>

      {/* Navegação Mobile High-End */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900/90 backdrop-blur-xl border-t border-neutral-800 p-2 z-50">
        <div className="max-w-lg mx-auto flex justify-around items-center">
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
          <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" label="Admin" color="text-red-600" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, urgent = false, color = "text-white" }: { active: boolean, onClick: () => void, icon: string, label: string, urgent?: boolean, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center p-2 rounded-xl transition-all relative ${active ? 'bg-red-900/10 scale-110' : 'opacity-40 hover:opacity-100 hover:bg-neutral-800'}`}
    >
      {urgent && (
        <span className="absolute top-1 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
      <span className="text-xl mb-1">{icon}</span>
      <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-red-500' : color}`}>{label}</span>
      {active && <div className="absolute -bottom-1 w-4 h-0.5 bg-red-600 rounded-full animate-in zoom-in"></div>}
    </button>
  );
}

export default App;
