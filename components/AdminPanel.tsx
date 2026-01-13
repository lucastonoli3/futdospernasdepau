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
            // Verificar badges automáticas após o update
            const updatedPlayer = { ...player, [type]: newValue };
            await checkAndAssignBadges(updatedPlayer as Player);
        }
    };

    const updateSession = async (updates: Partial<MatchSession>) => {
        // Mapear campos camelCase para snake_case do Supabase
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
            alert("Erro ao salvar caixa. Você criou a tabela 'finances' no Supabase?");
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
        const updatedMoral = eventType === 'puskas' ? Math.min(100, player.moralScore + 15) :
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

        // 1. Confirmar no bueiro
        const { error: hError } = await supabase
            .from('humiliations')
            .update({
                status: 'confirmed',
                badge_id: h.badge_id // Garantir que está salvo se houver
            })
            .eq('id', h.id);

        if (hError) return;

        // 2. Atualizar Moral e dar Badge
        const performer = players.find(p => p.id === h.performer_id);
        const victim = players.find(p => p.id === h.victim_id);

        if (performer && victim) {
            // Performer ganha 10, Vítima perde 10
            const newPerformerMoral = Math.min(100, (performer?.moralScore || 0) + 10);
            const newVictimMoral = Math.max(0, (victim?.moralScore || 0) - 10);

            // Adicionar badge opcional ao performer
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

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-8">
                <div>
                    <h2 className="text-4xl font-oswald font-black text-white uppercase italic tracking-tighter">Comando Central</h2>
                    <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.5em]">Acesso Administrativo • Sigilo Absoluto</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-neutral-900 border border-neutral-800 px-4 py-2 text-center">
                        <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Caixa Real</p>
                        <p className="text-xl font-oswald text-green-500">R$ {finances?.total_balance || 0}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 💀 SISTEMA DE PENITÊNCIA (HUMILHAÇÕES PENDENTES) */}
                <section className="bg-neutral-900 border-2 border-red-900 p-6 space-y-6 lg:col-span-2 shadow-[0_0_50px_rgba(153,27,27,0.1)]">
                    <h3 className="text-xl font-oswald text-red-600 uppercase italic flex items-center gap-3">
                        <span className="animate-pulse">💀</span> Tribunal da Humilhação (Pedidos Pendentes)
                    </h3>

                    <div className="space-y-4">
                        {pendingHumiliations.length === 0 ? (
                            <p className="text-neutral-700 font-mono text-xs uppercase italic">Nenhuma presepada reportada até agora...</p>
                        ) : (
                            pendingHumiliations.map(h => {
                                const performer = players.find(p => p.id === h.performer_id);
                                const victim = players.find(p => p.id === h.victim_id);
                                return (
                                    <div key={h.id} className="bg-black border border-neutral-800 p-4 flex flex-col gap-4">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="text-center">
                                                    <p className="text-[9px] text-green-500 font-black uppercase">Executor</p>
                                                    <p className="text-white font-oswald uppercase">{performer?.nickname || '???'}</p>
                                                </div>
                                                <div className="text-red-600 font-black text-xl italic animate-bounce">
                                                    ➔ {h.type.toUpperCase()} ➔
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[9px] text-red-500 font-black uppercase">Vítima</p>
                                                    <p className="text-white font-oswald uppercase">{victim?.nickname || '???'}</p>
                                                </div>
                                            </div>

                                            <div className="bg-neutral-800/50 p-3 flex-1 border-l-2 border-red-600">
                                                <p className="text-[9px] text-neutral-500 uppercase font-black mb-1">Relato do Ocorrido:</p>
                                                <p className="text-xs text-white italic font-mono">"{h.description || 'Sem detalhes...'}"</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-4 items-center border-t border-neutral-800 pt-4">
                                            <div className="flex-1 w-full">
                                                <p className="text-[9px] text-neutral-500 uppercase font-black mb-2">Condecorar com Badge? (Opcional):</p>
                                                <select
                                                    value={h.badge_id || ''}
                                                    onChange={async (e) => {
                                                        const newVal = e.target.value;
                                                        await supabase.from('humiliations').update({ badge_id: newVal }).eq('id', h.id);
                                                        fetchHumiliations();
                                                    }}
                                                    className="w-full bg-black border border-neutral-800 p-2 text-[10px] text-white font-mono outline-none focus:border-red-600 appearance-none"
                                                >
                                                    <option value="">Nenhuma Badge</option>
                                                    {ALL_BADGES.map(b => (
                                                        <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <button
                                                    onClick={() => handleConfirmHumiliation(h, false)}
                                                    className="flex-1 md:flex-none px-6 py-3 border border-neutral-700 text-neutral-500 hover:bg-white hover:text-black transition-all text-[10px] font-black uppercase italic"
                                                >Falsidade (Recusar)</button>
                                                <button
                                                    onClick={() => handleConfirmHumiliation(h, true)}
                                                    className="flex-1 md:flex-none px-6 py-3 bg-red-700 hover:bg-red-600 text-white transition-all text-[10px] font-black uppercase italic shadow-[0_0_20px_rgba(185,28,28,0.2)]"
                                                >É VERDADE (CONFIRMAR)</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* 🏦 GESTÃO DO COFRE (NOVO) */}
                <section className="bg-neutral-900 border border-neutral-800 p-6 space-y-6">
                    <h3 className="text-lg font-oswald text-green-600 uppercase italic flex items-center gap-2 underline decoration-green-900">
                        <span>🏦</span> O Cofre da Várzea
                    </h3>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[9px] text-neutral-500 uppercase font-black mb-1 block">Saldo Total em Mãos (R$)</label>
                                <input
                                    type="number"
                                    value={tempBalance}
                                    onChange={(e) => setTempBalance(e.target.value)}
                                    className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald text-xl outline-none focus:border-green-600"
                                />
                            </div>
                            <button
                                onClick={handleUpdateBalance}
                                disabled={isSavingFinances}
                                className="mt-5 px-6 bg-green-700 hover:bg-green-600 text-white font-black font-oswald uppercase italic tracking-widest transition-all"
                            >
                                {isSavingFinances ? 'UPDATING...' : 'SALVAR'}
                            </button>
                        </div>

                        <div className="border-t border-neutral-800 pt-6">
                            <label className="text-[9px] text-neutral-500 uppercase font-black mb-3 block">Objetivos da Pelada (Uniforme, Churrasco, etc)</label>
                            <div className="space-y-2 mb-4">
                                {finances?.goals?.map(goal => (
                                    <div key={goal.id} className="bg-black/50 border border-neutral-800 p-3 flex justify-between items-center group">
                                        <div>
                                            <p className="text-white font-oswald text-xs uppercase">{goal.title}</p>
                                            <p className="text-[9px] text-neutral-600 font-mono uppercase">Meta: R$ {goal.target}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-green-500 font-oswald font-bold leading-none">R$ {goal.current}</p>
                                            <div className="w-20 h-1 bg-neutral-800 mt-1">
                                                <div className="h-full bg-green-600" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    placeholder="Ex: Novo Uniforme"
                                    value={newGoal.title}
                                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                                    className="bg-black border border-neutral-800 p-2 text-xs text-white outline-none focus:border-green-600"
                                />
                                <input
                                    placeholder="Meta R$"
                                    type="number"
                                    value={newGoal.target}
                                    onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                                    className="bg-black border border-neutral-800 p-2 text-xs text-white outline-none focus:border-green-600"
                                />
                            </div>
                            <button
                                onClick={handleAddGoal}
                                className="w-full mt-2 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-black font-oswald uppercase italic text-[10px] tracking-widest transition-all border border-neutral-700"
                            >
                                Adicionar Novo Objetivo
                            </button>
                        </div>
                    </div>
                </section>

                {/* ⚔️ Gestão de Ocorrências */}
                <section className="bg-neutral-900 border border-neutral-800 p-6 space-y-6">
                    <h3 className="text-lg font-oswald text-red-600 uppercase italic flex items-center gap-2 underline decoration-red-900">
                        <span>⚔️</span> Registro de Crimes & Atos de Bravura
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <select
                                value={selectedPlayerId}
                                onChange={(e) => setSelectedPlayerId(e.target.value)}
                                className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald uppercase text-sm outline-none focus:border-red-900 transition-all appearance-none"
                            >
                                <option value="">Escolha o alvo...</option>
                                {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <select
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value as any)}
                                className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald uppercase text-sm outline-none focus:border-red-900 transition-all appearance-none"
                            >
                                <option value="resenha">Resenha Comum</option>
                                <option value="puskas">Gol Puskas (Elite)</option>
                                <option value="vexame">Bisonhada/Vexame</option>
                                <option value="quebra_bola">Caneleiro Selvagem</option>
                            </select>
                            <div className={`p-3 border font-black font-oswald uppercase text-center text-sm ${eventType === 'puskas' ? 'border-yellow-600/30 text-yellow-500 bg-yellow-900/10' : 'border-red-900/30 text-red-600 bg-red-900/10'}`}>
                                {eventType === 'puskas' ? '+15 Moral' : eventType === 'resenha' ? '0 Moral' : '-15 Moral'}
                            </div>
                        </div>

                        <textarea
                            value={eventDescription}
                            onChange={(e) => setEventDescription(e.target.value)}
                            placeholder="Descreva o ocorrido com o máximo de deboche..."
                            className="w-full bg-black border border-neutral-800 p-3 h-24 text-white font-mono text-xs outline-none focus:border-red-900 transition-all resize-none"
                        />

                        <button
                            onClick={handleAddEvent}
                            className="w-full py-4 bg-red-700 hover:bg-red-800 text-white font-black font-oswald uppercase italic tracking-widest transition-all"
                        >
                            Protocolar na Fixa
                        </button>
                    </div>
                </section>

                {/* 💰 Controle de Pagamentos */}
                <section className="bg-neutral-900 border border-neutral-800 p-6 lg:col-span-2">
                    <div className="flex justify-between items-end mb-6">
                        <h3 className="text-lg font-oswald text-yellow-600 uppercase italic flex items-center gap-2 underline decoration-yellow-900">
                            💰 Cobrança & Dívida Ativa
                        </h3>
                        <div className="text-right">
                            <p className="text-[9px] text-neutral-500 font-black uppercase">Pendências Totais</p>
                            <p className="text-xl font-oswald text-red-600">R$ {players.reduce((acc, p) => acc + (p.isPaid ? 0 : 25), 0)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {players.map(p => (
                            <div key={p.id} className={`flex items-center justify-between p-3 bg-black border transition-all ${p.isPaid ? 'border-neutral-800/50' : 'border-red-900/30 animate-pulse'}`}>
                                <div className="flex items-center gap-3">
                                    <img src={p.photo} className={`w-8 h-8 object-cover ${!p.isPaid ? 'grayscale-0 border-red-600' : 'grayscale border-neutral-800'}`} />
                                    <div>
                                        <p className="text-white font-oswald text-[11px] uppercase leading-none">{p.nickname}</p>
                                        <p className={`text-[8px] font-mono uppercase ${p.isPaid ? 'text-neutral-600' : 'text-red-500 font-bold'}`}>
                                            {p.isPaid ? 'OK • QUITADO' : 'DEVENDO R$ 25'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleTogglePaid(p)}
                                    className={`px-3 py-1 border text-[9px] font-black uppercase tracking-tighter transition-all ${p.isPaid ? 'border-neutral-700 text-neutral-500 hover:bg-red-900/20 hover:text-red-500' : 'border-green-600 text-green-500 hover:bg-green-600 hover:text-black'}`}
                                >
                                    {p.isPaid ? 'Reabrir' : 'Recebido'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 🏟️ CONTROLE DE PARTIDA (LIVE) */}
                {
                    currentSession?.status === 'em_jogo' && (
                        <section className="bg-neutral-900 border-2 border-blue-900 p-6 space-y-6 lg:col-span-2 shadow-[0_0_50px_rgba(37,99,235,0.1)]">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-oswald text-blue-500 uppercase italic flex items-center gap-2 underline decoration-blue-900">
                                    <span className="animate-pulse">🏟️</span> Controle de Partida (Em Tempo Real)
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {players.map(p => {
                                    const isPresent = currentSession?.playersPresent?.includes(p.id);
                                    if (!isPresent && (currentSession?.playersPresent?.length || 0) > 0) return null;

                                    return (
                                        <div key={p.id} className="bg-black border border-neutral-800 p-4 flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <img src={p.photo} className="w-10 h-10 object-cover border border-neutral-800" />
                                                <div>
                                                    <p className="text-white font-oswald text-sm uppercase">{p.nickname}</p>
                                                    <div className="flex gap-2 text-[9px] font-mono uppercase text-neutral-500">
                                                        <span>Gols: {p.goals}</span>
                                                        <span>Ast: {p.assists}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdateStat(p.id, 'goals')}
                                                    className="flex-1 py-2 bg-green-900/20 border border-green-600/30 text-green-500 font-black font-oswald text-[10px] uppercase hover:bg-green-600 hover:text-black transition-all"
                                                >+ GOL</button>
                                                <button
                                                    onClick={() => handleUpdateStat(p.id, 'assists')}
                                                    className="flex-1 py-2 bg-blue-900/20 border border-blue-600/30 text-blue-500 font-black font-oswald text-[10px] uppercase hover:bg-blue-600 hover:text-black transition-all"
                                                >+ ASSIST</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )
                }

                <section className="bg-neutral-900 border border-neutral-800 p-6 lg:col-span-2">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 className="text-lg font-oswald text-white uppercase italic flex items-center gap-2">
                            <span>⏰</span> Planejamento & Votação (Ciclo Semanal)
                        </h3>
                        <div className="flex gap-2 w-full md:w-auto">
                            <select
                                value={currentSession?.matchDay ?? 1}
                                onChange={(e) => updateSession({ matchDay: parseInt(e.target.value) })}
                                className="bg-black border border-neutral-700 text-[10px] text-white font-black uppercase p-2 outline-none focus:border-white"
                            >
                                {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, idx) => (
                                    <option key={idx} value={idx}>Dia da Pelada: {day}</option>
                                ))}
                            </select>
                            <select
                                value={currentSession?.manualVotingStatus ?? 'auto'}
                                onChange={(e) => updateSession({ manualVotingStatus: e.target.value as any })}
                                className="bg-black border border-neutral-700 text-[10px] text-white font-black uppercase p-2 outline-none focus:border-white"
                            >
                                <option value="auto">Modo: Automático (23:59)</option>
                                <option value="open">Modo: SEMPRE ABERTO</option>
                                <option value="closed">Modo: SEMPRE FECHADO</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <button
                            onClick={() => updateSession({ votingOpen: true, status: 'votacao_aberta' })}
                            className="py-4 border border-yellow-600/30 text-yellow-500 font-black font-oswald uppercase text-xs hover:bg-yellow-600 hover:text-black transition-all italic"
                        >
                            Abrir Chamada (Presença)
                        </button>
                        <button
                            onClick={async () => {
                                if (!currentSession) return;
                                // Incrementar matches_played para todos os selecionados
                                for (const p of players) {
                                    if (currentSession.playersPresent?.includes(p.id)) {
                                        const newMatches = (p.matchesPlayed || 0) + 1;
                                        await supabase.from('players').update({ matches_played: newMatches }).eq('id', p.id);
                                        // Verificar badge de presença
                                        await checkAndAssignBadges({ ...p, matchesPlayed: newMatches });
                                    }
                                }
                                updateSession({ status: 'em_jogo' });
                                onUpdatePlayer();
                            }}
                            className="py-4 border border-blue-600/30 text-blue-500 font-black font-oswald uppercase text-xs hover:bg-blue-600 hover:text-black transition-all italic"
                        >
                            Apitar Início (Live)
                        </button>
                        <button
                            onClick={() => currentSession && updateSession({ status: 'finalizado', votingOpen: true })}
                            className="py-4 border border-red-600/30 text-red-500 font-black font-oswald uppercase text-xs hover:bg-red-600 hover:text-black transition-all italic"
                        >
                            Encerrar & Votar
                        </button>
                        <button
                            onClick={() => { if (currentSession && confirm("Zerar semana?")) updateSession({ status: 'vago', votingOpen: false, manualVotingStatus: 'auto' }) }}
                            className="py-4 border border-neutral-700 text-neutral-500 font-black font-oswald uppercase text-xs hover:bg-white hover:text-black transition-all italic"
                        >
                            Resetar Ciclo
                        </button>
                    </div>
                </section>
                <section className="bg-neutral-900 border border-neutral-800 p-6 lg:col-span-2">
                    <h3 className="text-lg font-oswald text-purple-600 uppercase italic mb-6 flex items-center gap-2">
                        <span>🏅</span> Loja de Condecorações (Badge Management)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {players.map(p => (
                            <div key={p.id} className="bg-black border border-neutral-800 p-4 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <img src={p.photo} className="w-8 h-8 rounded-full border border-neutral-700" />
                                    <p className="text-xs font-black text-white uppercase">{p.nickname}</p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {p.badges?.map(bid => (
                                        <div key={bid} onClick={() => handleGiveBadge(p.id, bid)} className="cursor-pointer opacity-80 hover:opacity-100 hover:scale-110 transition-all">
                                            <BadgeDisplay badgeId={bid} />
                                        </div>
                                    ))}
                                </div>
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleGiveBadge(p.id, e.target.value);
                                            e.target.value = "";
                                        }
                                    }}
                                    className="w-full bg-neutral-900 border border-neutral-800 p-2 text-[9px] text-neutral-500 uppercase font-black outline-none focus:border-purple-600"
                                >
                                    <option value="">Condecorar / Retirar...</option>
                                    {ALL_BADGES.map(b => (
                                        <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </section>
            </div >
        </div >
    );
};

export default AdminPanel;
