import React, { useState } from 'react';
import { Player, MatchSession, GlobalFinances, FinancialGoal } from '../types';
import { supabase } from '../services/supabaseClient';
import { ALL_BADGES } from '../constants';
import BadgeDisplay from './BadgeDisplay';
import { checkAndAssignBadges } from '../services/statsService';

interface AdminPanelProps {
    players: Player[];
    currentSession: MatchSession;
    finances: GlobalFinances;
    onUpdatePlayer: () => void;
    onUpdateSession: () => void;
    onUpdateFinances: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ players, currentSession, finances, onUpdatePlayer, onUpdateSession, onUpdateFinances }) => {
    const [activeTab, setActiveTab] = useState<'session' | 'players' | 'finances' | 'system'>('session');
    const [loading, setLoading] = useState(false);

    // Estados para Ocorrências
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventType, setEventType] = useState<'puskas' | 'vexame' | 'quebra_bola' | 'resenha'>('resenha');

    // Estados para Finanças
    const [tempBalance, setTempBalance] = useState<string>(finances?.total_balance?.toString() || '0');
    const [isSavingFinances, setIsSavingFinances] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', target: '' });

    // Estados para Humilhações
    const [pendingHumiliations, setPendingHumiliations] = useState<any[]>([]);

    React.useEffect(() => {
        fetchHumiliations();
    }, []);

    const fetchHumiliations = async () => {
        const { data, error } = await supabase
            .from('humiliations')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (data) setPendingHumiliations(data);
    };

    const handleUpdateStat = async (playerId: string, type: 'goals' | 'assists') => {
        const player = players.find(p => p.id === playerId);
        if (!player) return;

        const newValue = (type === 'goals' ? player.goals : player.assists) + 1;

        const { error } = await supabase
            .from('players')
            .update({ [type === 'goals' ? 'goals' : 'assists']: newValue })
            .eq('id', playerId);

        if (!error) {
            onUpdatePlayer();
            const updatedPlayer = { ...player, [type]: newValue };
            await checkAndAssignBadges(updatedPlayer as Player);
        }
    };

    const updateSession = async (updates: Partial<MatchSession>) => {
        const dbUpdates: any = {};
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.votingOpen !== undefined) dbUpdates.voting_open = updates.votingOpen;
        if (updates.playersPresent !== undefined) dbUpdates.players_present = updates.playersPresent;
        if (updates.matchDay !== undefined) dbUpdates.match_day = updates.matchDay;
        if (updates.manualVotingStatus !== undefined) dbUpdates.manual_voting_status = updates.manualVotingStatus;

        const { error } = await supabase
            .from('sessions')
            .update(dbUpdates)
            .eq('id', 1);

        if (error) {
            alert("ERRO AO ATUALIZAR SESSÃO NO SUPABASE. Tenta de novo, mestre.");
            console.error(error);
        } else {
            onUpdateSession();
        }
    };

    const handleToggleVoting = () => {
        if (!currentSession) return;
        updateSession({ votingOpen: !currentSession.votingOpen });
    };

    const handleUpdateStatus = (status: MatchSession['status']) => {
        updateSession({ status });
    };

    const handleUpdateBalance = async () => {
        setIsSavingFinances(true);
        try {
            const { error } = await supabase
                .from('finances')
                .update({ total_balance: parseFloat(tempBalance) })
                .eq('id', 1);

            if (error) throw error;
            onUpdateFinances();
            alert("CAIXA ATUALIZADO NO SUPABASE! 💸");
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar caixa.");
        } finally {
            setIsSavingFinances(false);
        }
    };

    const handleAddGoal = async () => {
        if (!newGoal.title || !newGoal.target) return;
        const goal: FinancialGoal = {
            id: Math.random().toString(36).substr(2, 9),
            title: newGoal.title,
            target: parseFloat(newGoal.target),
            current: 0
        };

        const currentGoals = finances?.goals || [];
        const updatedGoals = [...(Array.isArray(currentGoals) ? currentGoals : []), goal];
        const { error } = await supabase.from('finances').update({ goals: updatedGoals }).eq('id', 1);
        if (!error) {
            onUpdateFinances();
            setNewGoal({ title: '', target: '' });
        }
    };

    const handleAddEvent = async () => {
        const player = players.find(p => p.id === selectedPlayerId);
        if (!player) return;

        const newEvent = {
            id: Math.random().toString(36).substr(2, 9),
            player_id: player.id,
            type: eventType,
            description: eventDescription,
            date: new Date().toISOString()
        };

        const updatedEvents = [...(player.specialEvents || []), newEvent];
        const updatedMoral = eventType === 'puskas' ? Math.min(1000, player.moralScore + 15) :
            eventType === 'vexame' ? Math.max(0, player.moralScore - 15) : player.moralScore;

        const { error } = await supabase
            .from('players')
            .update({
                special_events: updatedEvents,
                moral_score: updatedMoral
            })
            .eq('id', player.id);

        if (!error) {
            onUpdatePlayer();
            setEventDescription('');
            alert("OCORRÊNCIA PROTOCOLADA! 📜");
        }
    };

    const handleTogglePaid = async (player: Player) => {
        const { error } = await supabase
            .from('players')
            .update({ is_paid: !player.isPaid, debt: !player.isPaid ? 0 : 25 })
            .eq('id', player.id);

        if (!error) {
            onUpdatePlayer();
        }
    };

    const handleConfirmHumiliation = async (h: any, approve: boolean) => {
        if (!approve) {
            await supabase.from('humiliations').update({ status: 'rejected' }).eq('id', h.id);
            fetchHumiliations();
            return;
        }

        const { error: hError } = await supabase
            .from('humiliations')
            .update({
                status: 'confirmed',
                badge_id: h.badge_id
            })
            .eq('id', h.id);

        if (hError) return;

        const performer = players.find(p => p.id === h.performer_id);
        const victim = players.find(p => p.id === h.victim_id);

        if (performer && victim) {
            const newPerformerMoral = (performer?.moralScore || 0) + 10;
            const newVictimMoral = Math.max(0, (victim?.moralScore || 0) - 10);

            let performerBadges = [...(performer.badges || [])];
            if (h.badge_id && !performerBadges.includes(h.badge_id)) {
                performerBadges.push(h.badge_id);
            }

            await supabase.from('players').update({
                moral_score: newPerformerMoral,
                badges: performerBadges
            }).eq('id', performer.id);

            await supabase.from('players').update({
                moral_score: newVictimMoral
            }).eq('id', victim.id);
        }

        fetchHumiliations();
        onUpdatePlayer();
        alert("CRIME CONFIRMADO! A moral foi ajustada e a medalha entregue.");
    };

    const handleDeleteHumiliation = async (id: string) => {
        const { error } = await supabase.from('humiliations').delete().eq('id', id);
        if (!error) {
            fetchHumiliations();
        }
    };

    const handleGiveBadge = async (playerId: string, badgeId: string) => {
        const player = players.find(p => p.id === playerId);
        if (!player) return;

        let updatedBadges = [...player.badges];
        if (updatedBadges.includes(badgeId)) {
            updatedBadges = updatedBadges.filter(b => b !== badgeId);
        } else {
            updatedBadges.push(badgeId);
        }

        const { error } = await supabase
            .from('players')
            .update({ badges: updatedBadges })
            .eq('id', player.id);

        if (!error) {
            onUpdatePlayer();
        }
    };

    const handleApplyMoralReset = async () => {
        if (!confirm('DESEJA RESETAR A MORAL DE TODOS OS VICIADOS PARA 100? ISSO É IRREVERSÍVEL.')) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('players')
                .update({ moral_score: 100 })
                // Removido filtro restritivo para garantir que TODOS sejam resetados
                .filter('id', 'neq', '00000000-0000-0000-0000-000000000000'); // Filtro dummy para garantir execução do update

            if (error) throw error;

            alert('MORAL RESETADA! O EQUILÍBRIO FOI RESTABELECIDO PARA TODOS.');
            onUpdatePlayer();
        } catch (err: any) {
            console.error('Erro no reset:', err);
            alert(`ERRO AO RESETAR: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon }: { id: any, label: string, icon: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center py-4 px-2 transition-all border-b-2 font-oswald uppercase italic tracking-tighter relative ${activeTab === id ? 'border-red-600 text-white bg-red-600/5' : 'border-neutral-800 text-neutral-500 hover:text-white'}`}
        >
            <span className="text-xl mb-1">{icon}</span>
            <span className="text-[10px] font-black">{label}</span>
            {activeTab === id && <div className="absolute top-0 w-1 h-1 bg-red-600 rounded-full animate-ping"></div>}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto animate-slide-up pb-24">
            <div className="mb-8 flex items-end justify-between px-2">
                <div>
                    <h2 className="section-title text-4xl md:text-5xl text-red-600 uppercase italic">Comando <span className="text-white">Central</span></h2>
                    <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.4em] mt-1">Nível de Autoridade: Administrador</p>
                </div>
                <div className="hidden md:block px-4 py-2 glass-panel border-red-900/20 rounded-xl">
                    <span className="text-[10px] font-mono text-red-500 animate-pulse">● FULL_CONTROL_ENABLED</span>
                </div>
            </div>

            <div className="glass-panel border-neutral-800/50 rounded-[32px] overflow-hidden backdrop-blur-2xl">
                <div className="flex border-b border-neutral-800/50 bg-neutral-900/20 overflow-x-auto no-scrollbar">
                    <TabButton id="session" label="Sessão" icon="⏱️" />
                    <TabButton id="players" label="Peladeiros" icon="👥" />
                    <TabButton id="finances" label="Caixa" icon="💰" />
                    <TabButton id="system" label="Sistema" icon="⚙️" />
                </div>

                <div className="p-6 md:p-8">
                    {activeTab === 'session' && (
                        <div className="space-y-8 animate-slide-up">
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-yellow-500 mb-6 flex items-center gap-2">
                                    <span>⚽</span> Controle de Sessão
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="p-4 bg-black/40 rounded-xl border border-neutral-800">
                                            <p className="text-[10px] text-neutral-500 uppercase font-black mb-1">Status Real (Cálculo IA)</p>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${currentSession?.votingOpen ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                                                <span className="text-lg font-oswald text-white uppercase italic">{currentSession?.votingOpen ? 'Votação Aberta' : 'Votação Fechada'}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] text-neutral-500 uppercase font-black px-1">Modo de Votação</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                <button
                                                    onClick={() => updateSession({ manualVotingStatus: 'auto' })}
                                                    className={`py-3 px-4 rounded-xl border font-oswald uppercase italic text-xs transition-all flex items-center justify-between ${currentSession?.manualVotingStatus === 'auto' ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600'}`}
                                                >
                                                    <span>AUTOMÁTICO (Seg. 21h-00h)</span>
                                                    {currentSession?.manualVotingStatus === 'auto' && <span>✓</span>}
                                                </button>
                                                <button
                                                    onClick={() => updateSession({ manualVotingStatus: 'open' })}
                                                    className={`py-3 px-4 rounded-xl border font-oswald uppercase italic text-xs transition-all flex items-center justify-between ${currentSession?.manualVotingStatus === 'open' ? 'bg-green-600/20 text-green-500 border-green-600/50' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600'}`}
                                                >
                                                    <span>FORÇAR ABRIR AGORA</span>
                                                    {currentSession?.manualVotingStatus === 'open' && <span>⚡</span>}
                                                </button>
                                                <button
                                                    onClick={() => updateSession({ manualVotingStatus: 'closed' })}
                                                    className={`py-3 px-4 rounded-xl border font-oswald uppercase italic text-xs transition-all flex items-center justify-between ${currentSession?.manualVotingStatus === 'closed' ? 'bg-red-600/20 text-red-500 border-red-600/50' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600'}`}
                                                >
                                                    <span>FORÇAR FECHAR AGORA</span>
                                                    {currentSession?.manualVotingStatus === 'closed' && <span>🔒</span>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-[10px] text-neutral-500 uppercase font-black px-1">Mudar Estado Global</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleUpdateStatus('resenha')}
                                                className={`p-4 rounded-xl border font-oswald uppercase italic text-xs transition-all ${currentSession?.status === 'resenha' ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'}`}
                                            >RE-S-E-N-H-A</button>
                                            <button
                                                onClick={() => handleUpdateStatus('partida')}
                                                className={`p-4 rounded-xl border font-oswald uppercase italic text-xs transition-all ${currentSession?.status === 'partida' ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'}`}
                                            >P-A-R-T-I-D-A</button>
                                            <button
                                                onClick={() => handleUpdateStatus('em_jogo')}
                                                className={`p-4 rounded-xl border font-oswald uppercase italic text-xs transition-all ${currentSession?.status === 'em_jogo' ? 'bg-blue-600 text-white border-blue-500' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'}`}
                                            >EM JOGO (LIVE)</button>
                                            <button
                                                onClick={() => handleUpdateStatus('finalizado')}
                                                className={`p-4 rounded-xl border font-oswald uppercase italic text-xs transition-all ${currentSession?.status === 'finalizado' ? 'bg-red-600 text-white border-red-500' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'}`}
                                            >FINALIZAR</button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* TRIBUNAL DA HUMILHAÇÃO */}
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-red-600 mb-6 flex items-center gap-2">
                                    <span>💀</span> Tribunal da Humilhação ({pendingHumiliations.length})
                                </h3>
                                {pendingHumiliations.length === 0 ? (
                                    <div className="p-8 text-center bg-black/20 rounded-xl border border-dashed border-neutral-800">
                                        <p className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest italic">Nenhuma infração reportada. O bueiro está em paz.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {pendingHumiliations.map(hum => {
                                            const performer = players.find(p => p.id === hum.performer_id);
                                            const victim = players.find(p => p.id === hum.victim_id);
                                            return (
                                                <div key={hum.id} className="glass-panel p-5 rounded-2xl border-white/5 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-mono text-neutral-500 uppercase">{new Date(hum.created_at).toLocaleTimeString()}</span>
                                                        <span className="text-[10px] font-black font-oswald bg-red-900/20 text-red-500 px-3 py-1 rounded-full uppercase italic tracking-widest border border-red-900/30">Análise Requerida</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 bg-black/30 p-4 rounded-xl">
                                                        <div className="text-center flex-1">
                                                            <p className="text-[9px] text-green-500 uppercase font-black mb-1">Doido</p>
                                                            <p className="text-sm font-oswald text-white uppercase italic">{performer?.nickname || hum.performerNickname}</p>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-red-600 font-black animate-pulse">➔</span>
                                                            <span className="text-[8px] text-neutral-600 font-mono uppercase font-black">{hum.type}</span>
                                                        </div>
                                                        <div className="text-center flex-1">
                                                            <p className="text-[9px] text-red-500 uppercase font-black mb-1">Vítima</p>
                                                            <p className="text-sm font-oswald text-white uppercase italic">{victim?.nickname || hum.victimNickname}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                                        <p className="text-xs text-neutral-400 italic leading-relaxed">"{hum.description}"</p>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <p className="text-[9px] text-neutral-500 uppercase font-black mb-1">Condecorar com:</p>
                                                        <select
                                                            value={hum.badge_id || ''}
                                                            onChange={(e) => {
                                                                const newVal = e.target.value;
                                                                const updated = pendingHumiliations.map(ph => ph.id === hum.id ? { ...ph, badge_id: newVal } : ph);
                                                                setPendingHumiliations(updated);
                                                            }}
                                                            className="w-full bg-black border border-neutral-800 p-3 text-xs text-white uppercase font-oswald italic"
                                                        >
                                                            <option value="">Nenhuma Badge</option>
                                                            {ALL_BADGES.map(b => (
                                                                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
                                                            ))}
                                                        </select>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => handleConfirmHumiliation(hum, true)}
                                                                className="bg-green-600 hover:bg-green-500 text-white font-oswald font-black uppercase italic py-3 rounded-xl text-[10px] tracking-widest transition-all"
                                                            >CONFIRMAR</button>
                                                            <button
                                                                onClick={() => handleConfirmHumiliation(hum, false)}
                                                                className="bg-neutral-800 hover:bg-neutral-700 text-white font-oswald font-black uppercase italic py-3 rounded-xl text-[10px] tracking-widest transition-all border border-neutral-700"
                                                            >RECUSAR</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {activeTab === 'players' && (
                        <div className="space-y-6 animate-slide-up">
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-blue-500 mb-6 flex items-center gap-2">
                                    <span>👥</span> Gestão de Atletas
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/40 p-4 rounded-xl border border-neutral-800 mb-8">
                                    <div className="text-center">
                                        <p className="text-[10px] text-neutral-500 uppercase font-black mb-1">Atletas</p>
                                        <p className="text-2xl font-oswald text-white font-black">{players.length}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-neutral-500 uppercase font-black mb-1">Gols</p>
                                        <p className="text-2xl font-oswald text-white font-black">{players.reduce((acc, p) => acc + p.goals, 0)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-neutral-500 uppercase font-black mb-1">Moral Méd.</p>
                                        <p className="text-2xl font-oswald text-white font-black">{(players.reduce((acc, p) => acc + p.moralScore, 0) / players.length).toFixed(0)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-neutral-500 uppercase font-black mb-1">Dívidas</p>
                                        <p className="text-2xl font-oswald text-red-500 font-black">{players.filter(p => !p.isPaid).length}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] text-neutral-500 uppercase font-black px-1">Comandos de Reset</p>
                                    <button
                                        onClick={handleApplyMoralReset}
                                        disabled={loading}
                                        className="w-full p-5 bg-white text-black font-oswald font-black uppercase text-sm italic tracking-[0.2em] rounded-2xl hover:bg-neutral-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-[0.98]"
                                    >
                                        {loading ? 'RE-SETANDO...' : 'RESET GERAL DE MORAL (100)'}
                                    </button>
                                </div>

                                <div className="mt-8 border-t border-neutral-800 pt-8">
                                    <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-widest mb-4">Registro de Ocorrência Manual</h4>
                                    <div className="space-y-4">
                                        <select
                                            value={selectedPlayerId}
                                            onChange={(e) => setSelectedPlayerId(e.target.value)}
                                            className="w-full bg-black border border-neutral-800 p-4 text-white font-oswald uppercase text-sm italic rounded-xl"
                                        >
                                            <option value="">Escolha o alvo...</option>
                                            {players.sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                                        </select>

                                        <div className="grid grid-cols-2 gap-4">
                                            <select
                                                value={eventType}
                                                onChange={(e) => setEventType(e.target.value as any)}
                                                className="bg-black border border-neutral-800 p-4 text-white font-oswald uppercase text-xs italic rounded-xl"
                                            >
                                                <option value="resenha">Resenha Comum</option>
                                                <option value="puskas">Gol Puskas (+15)</option>
                                                <option value="vexame">Bisonhada (-15)</option>
                                                <option value="quebra_bola">Caneleiro (-15)</option>
                                            </select>
                                            <button
                                                onClick={handleAddEvent}
                                                className="bg-red-700 hover:bg-red-600 text-white font-oswald font-black uppercase italic text-xs tracking-widest rounded-xl transition-all"
                                            >PROTOCOLAR</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 border-t border-neutral-800 pt-8">
                                    <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-widest mb-4">Gestão de Badges</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {players.sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => (
                                            <div key={p.id} className="bg-black/30 border border-neutral-800 p-3 rounded-xl flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <img src={p.photo} className="w-8 h-8 object-cover rounded-full" />
                                                    <p className="text-[10px] font-oswald text-white uppercase italic">{p.nickname}</p>
                                                </div>
                                                <select
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleGiveBadge(p.id, e.target.value);
                                                            e.target.value = "";
                                                        }
                                                    }}
                                                    className="bg-neutral-900 border border-neutral-800 text-[8px] text-neutral-500 uppercase p-1 rounded"
                                                >
                                                    <option value="">Badge...</option>
                                                    {ALL_BADGES.map(b => (
                                                        <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'finances' && (
                        <div className="space-y-6 animate-slide-up">
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-emerald-500 mb-6 flex items-center gap-2">
                                    <span>💰</span> Gestão do Caixa
                                </h3>

                                <div className="p-6 bg-black/40 rounded-2xl border border-emerald-500/20 mb-8 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-neutral-500 uppercase font-black mb-1">Total Disponível</p>
                                        <div className="flex items-end gap-1">
                                            <span className="text-4xl font-oswald text-emerald-500 font-black italic tracking-tighter">R$ {parseFloat(tempBalance).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUpdateBalance}
                                        className="p-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-black transition-all"
                                    >
                                        {isSavingFinances ? '⏳' : '💾 SALVAR'}
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] text-neutral-500 uppercase font-black px-1">Ajuste Manual de Saldo</label>
                                    <input
                                        type="number"
                                        value={tempBalance}
                                        onChange={(e) => setTempBalance(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 p-5 text-white font-oswald text-2xl italic tracking-tighter outline-none focus:border-emerald-600 rounded-2xl"
                                    />
                                </div>

                                <div className="mt-12">
                                    <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-widest mb-6 px-1 flex justify-between">
                                        <span>Metas & Projetos</span>
                                        <span className="text-emerald-500">{finances?.goals?.length || 0} Ativos</span>
                                    </h4>

                                    <div className="space-y-3 mb-8">
                                        {finances?.goals?.map(goal => (
                                            <div key={goal.id} className="bg-black/40 border border-neutral-800 p-4 rounded-xl flex justify-between items-center group hover:border-emerald-900/50 transition-all">
                                                <div>
                                                    <p className="text-white font-oswald text-sm uppercase italic">{goal.title}</p>
                                                    <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Meta: R$ {goal.target}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-emerald-500 font-oswald font-black italic">R$ {goal.current}</p>
                                                    <div className="w-24 h-1 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                            placeholder="Título do Alvo"
                                            value={newGoal.title}
                                            onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                                            className="col-span-1 md:col-span-1 bg-black border border-neutral-800 p-4 text-xs text-white rounded-xl italic font-oswald uppercase"
                                        />
                                        <input
                                            placeholder="Meta R$"
                                            type="number"
                                            value={newGoal.target}
                                            onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                                            className="bg-black border border-neutral-800 p-4 text-xs text-white rounded-xl italic font-oswald uppercase"
                                        />
                                        <button
                                            onClick={handleAddGoal}
                                            className="bg-neutral-800 hover:bg-neutral-700 text-white font-oswald font-black uppercase italic text-[10px] tracking-widest rounded-xl transition-all border border-neutral-700"
                                        >ADICIONAR</button>
                                    </div>
                                </div>

                                <div className="mt-12 border-t border-neutral-800 pt-8">
                                    <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-widest mb-4">Cobrança de Mensalidade</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {players.sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => (
                                            <div key={p.id} className={`flex items-center justify-between p-3 bg-black border transition-all rounded-xl ${p.isPaid ? 'border-neutral-800/50 opacity-60' : 'border-red-900/30 bg-red-900/5'}`}>
                                                <div className="flex items-center gap-3">
                                                    <img src={p.photo} className={`w-8 h-8 object-cover rounded-full ${p.isPaid ? 'grayscale' : 'border border-red-600'}`} />
                                                    <div>
                                                        <p className="text-white font-oswald text-[10px] uppercase leading-none italic">{p.nickname}</p>
                                                        <p className={`text-[8px] font-mono uppercase mt-1 ${p.isPaid ? 'text-neutral-600' : 'text-red-500 font-bold'}`}>
                                                            {p.isPaid ? 'OK' : 'PENDENTE'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleTogglePaid(p)}
                                                    className={`px-3 py-1 border text-[9px] font-black uppercase italic rounded-md transition-all ${p.isPaid ? 'border-neutral-700 text-neutral-500 hover:bg-neutral-800' : 'border-green-600 text-green-500 hover:bg-green-600 hover:text-black'}`}
                                                >
                                                    {p.isPaid ? 'REABRIR' : 'PAGO'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-6 animate-slide-up">
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-neutral-400 mb-6 flex items-center gap-2">
                                    <span>⚙️</span> Sistema de Segurança
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-neutral-800 group hover:border-red-900/30 transition-all">
                                        <div>
                                            <p className="text-white font-oswald uppercase italic text-sm">Modo de Quarentena</p>
                                            <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Trancar app para manutenção</p>
                                        </div>
                                        <div className="w-12 h-6 bg-neutral-800 rounded-full p-1 cursor-not-allowed opacity-50">
                                            <div className="w-4 h-4 bg-neutral-600 rounded-full"></div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onUpdateFinances()}
                                        className="w-full flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-neutral-800 hover:border-blue-900/30 transition-all"
                                    >
                                        <div>
                                            <p className="text-white font-oswald uppercase italic text-sm">Sincronização Forçada</p>
                                            <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Update manual do Supabase DB</p>
                                        </div>
                                        <span className="text-blue-500 font-black animate-spin-slow text-xl">↻</span>
                                    </button>
                                </div>
                            </section>

                            <div className="pt-12 text-center">
                                <div className="inline-block p-4 border border-dashed border-neutral-800 rounded-2xl">
                                    <p className="text-[8px] font-mono text-neutral-700 uppercase tracking-[0.5em] font-black">STABLE_REL_v4.5.1_XP_PRO</p>
                                    <p className="text-[8px] font-mono text-neutral-800 uppercase tracking-widest mt-2">Active Protocol: {currentSession?.id || 'NO_SESSION'}</p>
                                    <p className="text-[7px] font-mono text-neutral-900 uppercase mt-4 opacity-50">DESIGNED BY ANTIGRAVITY FOR FDP_ELITE</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
