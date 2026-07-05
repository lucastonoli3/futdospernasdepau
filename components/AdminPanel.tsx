import React, { useState } from 'react';
import { Player, MatchSession, GlobalFinances, FinancialGoal } from '../types';
import { supabase } from '../services/supabaseClient';
import { ALL_BADGES } from '../constants';
import BadgeDisplay from './BadgeDisplay';
import { checkAndAssignBadges } from '../services/statsService';
import { CAIXA, currentMonthRef, monthLabel } from '../brandConfig';

interface AdminPanelProps {
    players: Player[];
    currentSession: MatchSession;
    finances: GlobalFinances;
    onUpdatePlayer: () => void;
    onUpdateSession: () => void;
    onUpdateFinances: () => void;
    isTrainingMode: boolean;
    setIsTrainingMode: (val: boolean) => void;
    setTrainingConfirmedIds: (ids: string[]) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
    players,
    currentSession,
    finances,
    onUpdatePlayer,
    onUpdateSession,
    onUpdateFinances,
    isTrainingMode,
    setIsTrainingMode,
    setTrainingConfirmedIds
}) => {
    const [activeTab, setActiveTab] = useState<'session' | 'players' | 'finances' | 'system'>('session');
    const [loading, setLoading] = useState(false);

    // Guard only for critical state
    if (!players || players.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 glass-panel border-neutral-800 rounded-3xl mt-12">
                <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest">Aguardando Peladeiros...</p>
            </div>
        );
    }

    // Estados para Ocorrências
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventType, setEventType] = useState<'puskas' | 'vexame' | 'quebra_bola' | 'resenha'>('resenha');

    // Estados para Finanças
    const [tempBalance, setTempBalance] = useState<string>(finances?.total_balance?.toString() || '0');
    const [isSavingFinances, setIsSavingFinances] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', target: '' });

    // Estados para Tesouraria (mensalidade, PIX, extrato, comprovantes)
    const monthRef = currentMonthRef();
    const [pixForm, setPixForm] = useState({
        key: CAIXA.pix.key,
        holder: CAIXA.pix.holderName,
        amount: CAIXA.mensalidadeDefault.toString(),
    });
    const [mensalidades, setMensalidades] = useState<any[]>([]);
    const [cashflow, setCashflow] = useState<any[]>([]);
    const [newEntry, setNewEntry] = useState<{ type: 'entrada' | 'saida'; description: string; amount: string }>({ type: 'saida', description: '', amount: '' });
    const [mensalidadeSearch, setMensalidadeSearch] = useState('');
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    // Estados para Humilhações
    const [pendingHumiliations, setPendingHumiliations] = useState<any[]>([]);

    // Estados para Badges (Premium)
    const [selectedPlayerForBadge, setSelectedPlayerForBadge] = useState<Player | null>(null);
    const [badgeSearch, setBadgeSearch] = useState('');
    const [selectedBadgeCategory, setSelectedBadgeCategory] = useState<string>('Todas');

    const [presenceSearch, setPresenceSearch] = useState('');

    const filteredBadges = () => {
        return ALL_BADGES.filter(b => {
            const matchesSearch = b.name.toLowerCase().includes(badgeSearch.toLowerCase()) ||
                b.description.toLowerCase().includes(badgeSearch.toLowerCase());
            const matchesCategory = selectedBadgeCategory === 'Todas' || b.category === selectedBadgeCategory;
            return matchesSearch && matchesCategory;
        });
    };

    const selectedPlayerByBadges = (badgeIds: string[]) => {
        return ALL_BADGES.filter(b => badgeIds.includes(b.id));
    };

    React.useEffect(() => {
        fetchHumiliations();
        fetchTreasury();
    }, []);

    const fetchTreasury = async () => {
        try {
            const { data: settings } = await supabase.from('club_settings').select('*').eq('id', 1).maybeSingle();
            if (settings) {
                setPixForm({
                    key: settings.pix_key || CAIXA.pix.key,
                    holder: settings.pix_holder || CAIXA.pix.holderName,
                    amount: (settings.mensalidade_amount ?? CAIXA.mensalidadeDefault).toString(),
                });
            }
        } catch (e) { /* opcional */ }
        try {
            const { data } = await supabase.from('mensalidades').select('*').eq('month_ref', monthRef);
            if (data) setMensalidades(data);
        } catch (e) { /* opcional */ }
        try {
            const { data } = await supabase.from('cashflow').select('*').order('created_at', { ascending: false }).limit(50);
            if (data) setCashflow(data);
        } catch (e) { /* opcional */ }
    };

    const mensalidadeStatus = (playerId: string): 'pago' | 'pendente' | 'em_analise' => {
        const row = mensalidades.find(m => m.player_id === playerId);
        if (row) return row.status;
        const p = players.find(pl => pl.id === playerId);
        return p?.isPaid ? 'pago' : 'pendente';
    };

    const setMensalidade = async (playerId: string, status: 'pago' | 'pendente' | 'em_analise') => {
        const amount = parseFloat(pixForm.amount) || CAIXA.mensalidadeDefault;
        const { error } = await supabase.from('mensalidades').upsert({
            player_id: playerId,
            month_ref: monthRef,
            status,
            amount,
            paid_at: status === 'pago' ? new Date().toISOString() : null,
            confirmed_by: currentSession ? 'diretoria' : null,
        }, { onConflict: 'player_id,month_ref' });
        // Mantém o flag legado is_paid em sincronia (fallback do app)
        await supabase.from('players').update({ is_paid: status === 'pago', debt: status === 'pago' ? 0 : amount }).eq('id', playerId);
        if (error) {
            alert('Tabela "mensalidades" não encontrada. Rode a migração SQL (supabase_migration.sql).');
        } else {
            // Lança entrada no extrato ao confirmar pagamento
            if (status === 'pago') {
                const p = players.find(pl => pl.id === playerId);
                await supabase.from('cashflow').insert([{ type: 'entrada', description: `Mensalidade ${monthLabel(monthRef)} — ${p?.nickname || ''}`, amount }]).then(() => {}, () => {});
            }
            fetchTreasury();
            onUpdatePlayer();
        }
    };

    const handleSavePixSettings = async () => {
        const { error } = await supabase.from('club_settings').upsert({
            id: 1,
            pix_key: pixForm.key,
            pix_holder: pixForm.holder,
            mensalidade_amount: parseFloat(pixForm.amount) || CAIXA.mensalidadeDefault,
        });
        if (error) alert('Não consegui salvar. Rode a migração (tabela "club_settings").');
        else alert('Configurações de PIX/mensalidade salvas!');
    };

    const handleAddCashflow = async () => {
        const amount = parseFloat(newEntry.amount);
        if (!newEntry.description.trim() || !amount) return;
        const { error } = await supabase.from('cashflow').insert([{ type: newEntry.type, description: newEntry.description.trim(), amount }]);
        if (error) { alert('Tabela "cashflow" não encontrada. Rode a migração SQL.'); return; }
        setNewEntry({ type: 'saida', description: '', amount: '' });
        fetchTreasury();
    };

    const handleDeleteCashflow = async (id: string) => {
        await supabase.from('cashflow').delete().eq('id', id);
        fetchTreasury();
    };

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
        const nextStatus = currentSession.manualVotingStatus === 'open' ? 'closed' : 'open';
        updateSession({ manualVotingStatus: nextStatus });
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

    const handleResetSessionList = async () => {
        if (!confirm('⚠️ ATENÇÃO: Isso apagará a lista de presença e resetará o status de pagamento de TODOS os jogadores para a nova pelada. Confirmar?')) return;

        setLoading(true);
        try {
            // 1. Limpar lista de presença na sessão
            const { error: sError } = await supabase
                .from('sessions')
                .update({ players_present: [] })
                .eq('id', 1);

            if (sError) throw sError;

            // 2. Resetar status de pagamento e dívida de todos os jogadores (Setando como PAGO/0 por padrão a pedido do mestre)
            const { error: pError } = await supabase
                .from('players')
                .update({ is_paid: true, debt: 0 })
                .filter('id', 'neq', '00000000-0000-0000-0000-000000000000');

            if (pError) throw pError;

            alert('LISTA RESETADA E BURACO FECHADO! 🏟️ (Dívidas zeradas)');

            // Notificar Webhook do Make sobre o Reset
            fetch('https://hook.us2.make.com/9047p2y3vlis2gepi28i2md83cp0515d', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'reset_lista',
                    timestamp: new Date().toISOString()
                })
            }).catch(err => console.error('Erro ao notificar webhook reset:', err));

            onUpdateSession();
            onUpdatePlayer();
        } catch (err: any) {
            console.error('Erro no reset da lista:', err);
            alert(`ERRO AO RESETAR LISTA: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTestWebhook = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://hook.us2.make.com/9047p2y3vlis2gepi28i2md83cp0515d', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'teste_manual',
                    message: 'Ping do Administrador! O bueiro está online.',
                    timestamp: new Date().toISOString()
                })
            });
            if (response.ok) alert('SINAL ENVIADO! Verifique o Make.com 🚀');
            else alert('Erro ao enviar sinal. Verifique a URL.');
        } catch (err: any) {
            alert(`ERRO: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePresence = async (player: Player) => {
        const currentPresent = currentSession?.playersPresent || [];
        const isPresent = currentPresent.includes(player.id);

        const newPresent = isPresent
            ? currentPresent.filter(id => id !== player.id)
            : [...currentPresent, player.id];

        updateSession({ playersPresent: newPresent });

        fetch('https://hook.us2.make.com/9047p2y3vlis2gepi28i2md83cp0515d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'no-cors',
            body: JSON.stringify({
                event: !isPresent ? 'confirmacao_presenca' : 'cancelamento_presenca',
                player_nickname: player.nickname,
                total_confirmed: newPresent.length,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('Erro ao notificar webhook admin:', err));
    };

    const TabButton = ({ id, label, icon }: { id: any, label: string, icon: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center py-4 px-2 transition-all border-b-2 font-oswald uppercase italic tracking-tighter relative ${activeTab === id ? 'border-gold text-gold bg-gold/5' : 'border-neutral-800 text-neutral-500 hover:text-white'}`}
        >
            <span className="text-xl mb-1">{icon}</span>
            <span className="text-[10px] font-black">{label}</span>
            {activeTab === id && <div className="absolute top-0 w-1 h-1 bg-gold rounded-full animate-ping"></div>}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto animate-slide-up pb-24">
            <div className="mb-8 flex items-end justify-between px-2">
                <div>
                    <h2 className="section-title text-4xl md:text-5xl text-gold uppercase italic">Painel da <span className="text-white">Diretoria</span></h2>
                    <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.4em] mt-1">Balaio de Gato FC • Acesso da Diretoria</p>
                </div>
                <div className="hidden md:block px-4 py-2 glass-panel border-gold/20 rounded-xl">
                    <span className="text-[10px] font-mono text-gold animate-pulse">● DIRETORIA ONLINE</span>
                </div>
            </div>

            <div className="glass-panel border-neutral-800/50 rounded-[32px] overflow-hidden backdrop-blur-2xl">
                <div className="flex border-b border-neutral-800/50 bg-neutral-900/20 overflow-x-auto no-scrollbar">
                    <TabButton id="session" label="Jogo" icon="⏱️" />
                    <TabButton id="players" label="Sócios" icon="👥" />
                    <TabButton id="finances" label="Tesouraria" icon="💰" />
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

                                        <div className="pt-4 border-t border-neutral-800/50">
                                            <button
                                                onClick={handleResetSessionList}
                                                disabled={loading}
                                                className="w-full py-5 bg-red-600 text-white font-oswald font-black uppercase italic text-sm tracking-[0.2em] rounded-2xl hover:bg-red-500 transition-all active:scale-[0.98] shadow-xl shadow-red-900/20"
                                            >
                                                {loading ? 'PROCESSANDO...' : '☢️ RESETAR LISTA E CAIXA ☢️'}
                                            </button>
                                            <p className="text-[8px] text-neutral-600 font-mono uppercase text-center mt-2 italic">Limpa confirmados e reseta débitos p/ R$ 25</p>
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

                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-white mb-6 flex items-center gap-2">
                                    <span>📋</span> Lista de Presença Manual
                                </h3>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Buscar peladeiro..."
                                        value={presenceSearch}
                                        onChange={(e) => setPresenceSearch(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 p-4 text-white font-oswald text-sm italic outline-none focus:border-neutral-600 rounded-xl uppercase"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                        {players
                                            .filter(p => p.nickname.toLowerCase().includes(presenceSearch.toLowerCase()))
                                            .sort((a, b) => a.nickname.localeCompare(b.nickname))
                                            .map(p => {
                                                const isPresent = currentSession?.playersPresent?.includes(p.id);
                                                return (
                                                    <div key={p.id} className={`flex items-center justify-between p-3 bg-black border transition-all rounded-xl ${isPresent ? 'border-green-900/50 bg-green-900/10' : 'border-neutral-800/50'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <img src={p.photo} className={`w-8 h-8 object-cover rounded-full ${!isPresent ? 'grayscale opacity-50' : 'border border-green-600'}`} />
                                                            <div>
                                                                <p className="text-white font-oswald text-[10px] uppercase leading-none italic">{p.nickname}</p>
                                                                <p className={`text-[8px] font-mono uppercase mt-1 ${isPresent ? 'text-green-500 font-bold' : 'text-neutral-600'}`}>
                                                                    {isPresent ? 'CONFIRMADO' : 'FORA'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleTogglePresence(p)}
                                                            className={`px-3 py-1 border text-[9px] font-black uppercase italic rounded-md transition-all ${!isPresent ? 'border-green-600 text-green-500 hover:bg-green-600 hover:text-black' : 'border-red-900 text-red-500 hover:bg-red-900 hover:text-white'}`}
                                                        >
                                                            {isPresent ? 'REMOVER' : 'ADICIONAR'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
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
                                    <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-widest mb-4">Gestão de Badges Premium</h4>
                                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                        {players.sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => (
                                            <div key={p.id} className="bg-black/30 border border-neutral-800 p-3 rounded-2xl flex items-center justify-between group hover:border-red-900/50 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <img src={p.photo} className="w-10 h-10 object-cover rounded-full border border-neutral-800" />
                                                    <div>
                                                        <p className="text-xs font-oswald text-white uppercase italic">{p.nickname}</p>
                                                        <div className="flex gap-1 mt-1">
                                                            {p.badges.slice(0, 5).map(bid => {
                                                                const b = ALL_BADGES.find(x => x.id === bid);
                                                                return b ? <span key={bid} className="text-[10px]" title={b.name}>{b.icon}</span> : null;
                                                            })}
                                                            {p.badges.length > 5 && <span className="text-[8px] text-neutral-600">+{p.badges.length - 5}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedPlayerForBadge(p)}
                                                    className="px-4 py-2 bg-neutral-900 text-[10px] font-black uppercase text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all border border-neutral-800"
                                                >
                                                    GERENCIAR
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'finances' && (
                        <div className="space-y-6 animate-slide-up">
                            {/* PIX & MENSALIDADE */}
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-gold/20">
                                <h3 className="text-xl font-oswald italic uppercase text-gold mb-6 flex items-center gap-2">
                                    <span>🔑</span> PIX & Mensalidade
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2">
                                        <label className="text-[9px] text-neutral-500 uppercase font-black">Chave PIX</label>
                                        <input value={pixForm.key} onChange={e => setPixForm({ ...pixForm, key: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 p-3 text-white font-mono text-sm rounded-xl outline-none focus:border-gold mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-neutral-500 uppercase font-black">Valor (R$)</label>
                                        <input type="number" value={pixForm.amount} onChange={e => setPixForm({ ...pixForm, amount: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald text-lg rounded-xl outline-none focus:border-gold mt-1" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[9px] text-neutral-500 uppercase font-black">Recebedor (nome)</label>
                                        <input value={pixForm.holder} onChange={e => setPixForm({ ...pixForm, holder: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 p-3 text-white text-sm rounded-xl outline-none focus:border-gold mt-1" />
                                    </div>
                                    <button onClick={handleSavePixSettings}
                                        className="self-end bg-gold text-black font-oswald font-black uppercase italic text-xs rounded-xl py-3 hover:bg-gold-600 transition-all">💾 Salvar PIX</button>
                                </div>
                            </section>

                            {/* SALDO + COMPROVANTES EM ANÁLISE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <section className="bg-neutral-900/40 p-6 rounded-2xl border border-pitch-600/20">
                                    <h3 className="text-sm font-oswald italic uppercase text-pitch-400 mb-4 flex items-center gap-2"><span>🏦</span> Saldo do clube</h3>
                                    <div className="flex items-center gap-3">
                                        <input type="number" value={tempBalance} onChange={e => setTempBalance(e.target.value)}
                                            className="flex-1 bg-black border border-neutral-800 p-4 text-pitch-400 font-oswald text-2xl italic rounded-xl outline-none focus:border-pitch-600" />
                                        <button onClick={handleUpdateBalance}
                                            className="p-4 bg-pitch-600/10 border border-pitch-600/30 text-pitch-400 rounded-xl hover:bg-pitch-600 hover:text-black transition-all font-black">{isSavingFinances ? '⏳' : '💾'}</button>
                                    </div>
                                </section>

                                <section className="bg-neutral-900/40 p-6 rounded-2xl border border-gold/20">
                                    <h3 className="text-sm font-oswald italic uppercase text-gold mb-4 flex items-center gap-2">
                                        <span>📎</span> Comprovantes p/ conferir ({players.filter(p => mensalidadeStatus(p.id) === 'em_analise').length})
                                    </h3>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {players.filter(p => mensalidadeStatus(p.id) === 'em_analise').length === 0 ? (
                                            <p className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest">Nenhum comprovante aguardando.</p>
                                        ) : players.filter(p => mensalidadeStatus(p.id) === 'em_analise').map(p => {
                                            const row = mensalidades.find(m => m.player_id === p.id);
                                            return (
                                                <div key={p.id} className="flex items-center justify-between bg-black/40 border border-gold/20 rounded-xl p-2">
                                                    <div className="flex items-center gap-2">
                                                        <img src={p.photo} className="w-7 h-7 rounded-lg object-cover" />
                                                        <span className="text-[11px] font-oswald uppercase italic text-white">{p.nickname}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {row?.receipt_url && <button onClick={() => setReceiptPreview(row.receipt_url)} className="text-[9px] px-2 py-1 border border-neutral-700 text-neutral-300 rounded uppercase font-black">Ver</button>}
                                                        <button onClick={() => setMensalidade(p.id, 'pago')} className="text-[9px] px-2 py-1 bg-pitch-600 text-black rounded uppercase font-black">OK</button>
                                                        <button onClick={() => setMensalidade(p.id, 'pendente')} className="text-[9px] px-2 py-1 border border-red-600/40 text-red-400 rounded uppercase font-black">✕</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>

                            {/* MENSALIDADE DO MÊS */}
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-white mb-2 flex items-center gap-2"><span>💸</span> Mensalidade — {monthLabel(monthRef)}</h3>
                                <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mb-4">
                                    {players.filter(p => mensalidadeStatus(p.id) === 'pago').length} em dia • {players.filter(p => mensalidadeStatus(p.id) === 'pendente').length} pendente
                                </p>
                                <input
                                    type="text" placeholder="Buscar sócio..."
                                    value={mensalidadeSearch} onChange={e => setMensalidadeSearch(e.target.value)}
                                    className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald text-sm italic rounded-xl outline-none focus:border-gold mb-4 uppercase"
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                    {players.filter(p => p.nickname.toLowerCase().includes(mensalidadeSearch.toLowerCase()))
                                        .sort((a, b) => a.nickname.localeCompare(b.nickname)).map(p => {
                                            const st = mensalidadeStatus(p.id);
                                            return (
                                                <div key={p.id} className={`flex items-center justify-between p-3 bg-black border rounded-xl ${st === 'pago' ? 'border-pitch-600/30' : st === 'em_analise' ? 'border-gold/30' : 'border-red-900/30'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <img src={p.photo} className={`w-8 h-8 object-cover rounded-full ${st === 'pago' ? 'border border-pitch-600' : 'grayscale'}`} />
                                                        <p className="text-white font-oswald text-[11px] uppercase italic">{p.nickname}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setMensalidade(p.id, 'pago')}
                                                            className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${st === 'pago' ? 'bg-pitch-600 text-black' : 'border border-pitch-600/40 text-pitch-400 hover:bg-pitch-600 hover:text-black'}`}>Pago</button>
                                                        <button onClick={() => setMensalidade(p.id, 'pendente')}
                                                            className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${st === 'pendente' ? 'bg-red-600 text-white' : 'border border-red-600/40 text-red-400 hover:bg-red-600 hover:text-white'}`}>Pend.</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </section>

                            {/* EXTRATO */}
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h3 className="text-xl font-oswald italic uppercase text-white mb-4 flex items-center gap-2"><span>📒</span> Extrato (entradas & saídas)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                                    <select value={newEntry.type} onChange={e => setNewEntry({ ...newEntry, type: e.target.value as any })}
                                        className="bg-black border border-neutral-800 p-3 text-white font-oswald uppercase text-xs rounded-xl">
                                        <option value="entrada">Entrada</option>
                                        <option value="saida">Saída</option>
                                    </select>
                                    <input placeholder="Descrição" value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                                        className="col-span-2 md:col-span-2 bg-black border border-neutral-800 p-3 text-white text-xs rounded-xl outline-none focus:border-gold" />
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="R$" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald text-xs rounded-xl outline-none focus:border-gold" />
                                        <button onClick={handleAddCashflow} className="bg-gold text-black px-3 rounded-xl font-black">+</button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                                    {cashflow.length === 0 ? (
                                        <p className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest text-center py-4">Sem lançamentos ainda.</p>
                                    ) : cashflow.map(c => (
                                        <div key={c.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl group">
                                            <div className="flex items-center gap-3">
                                                <span>{c.type === 'entrada' ? '⬆️' : '⬇️'}</span>
                                                <div>
                                                    <p className="text-[11px] font-oswald uppercase italic text-neutral-200">{c.description}</p>
                                                    <p className="text-[8px] text-neutral-600 font-mono uppercase">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-oswald font-black text-sm ${c.type === 'entrada' ? 'text-pitch-400' : 'text-red-400'}`}>{c.type === 'entrada' ? '+' : '-'} R$ {Number(c.amount).toFixed(2)}</span>
                                                <button onClick={() => handleDeleteCashflow(c.id)} className="text-[9px] text-neutral-700 hover:text-red-500 opacity-0 group-hover:opacity-100 uppercase font-black">Excluir</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* METAS */}
                            <section className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
                                <h4 className="text-xs font-mono uppercase text-neutral-500 tracking-widest mb-4 flex justify-between">
                                    <span>🎯 Metas & Projetos</span>
                                    <span className="text-gold">{finances?.goals?.length || 0} ativos</span>
                                </h4>
                                <div className="space-y-3 mb-6">
                                    {finances?.goals?.map(goal => (
                                        <div key={goal.id} className="bg-black/40 border border-neutral-800 p-4 rounded-xl flex justify-between items-center">
                                            <div>
                                                <p className="text-white font-oswald text-sm uppercase italic">{goal.title}</p>
                                                <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Meta: R$ {goal.target}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gold font-oswald font-black italic">R$ {goal.current}</p>
                                                <div className="w-24 h-1 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full bg-gold" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input placeholder="Título da meta" value={newGoal.title} onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                                        className="bg-black border border-neutral-800 p-3 text-xs text-white rounded-xl italic font-oswald uppercase" />
                                    <input placeholder="Meta R$" type="number" value={newGoal.target} onChange={e => setNewGoal({ ...newGoal, target: e.target.value })}
                                        className="bg-black border border-neutral-800 p-3 text-xs text-white rounded-xl italic font-oswald uppercase" />
                                    <button onClick={handleAddGoal} className="bg-neutral-800 hover:bg-neutral-700 text-white font-oswald font-black uppercase italic text-[10px] tracking-widest rounded-xl border border-neutral-700">Adicionar</button>
                                </div>
                            </section>

                            {/* MODAL COMPROVANTE */}
                            {receiptPreview && (
                                <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-6" onClick={() => setReceiptPreview(null)}>
                                    <div className="max-w-md w-full" onClick={e => e.stopPropagation()}>
                                        <img src={receiptPreview} className="w-full rounded-2xl border border-gold/30" alt="Comprovante" />
                                        <button onClick={() => setReceiptPreview(null)} className="w-full mt-3 py-3 bg-gold text-black font-oswald font-black uppercase italic rounded-xl">Fechar</button>
                                    </div>
                                </div>
                            )}
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
                                        onClick={handleTestWebhook}
                                        disabled={loading}
                                        className="w-full flex items-center justify-between p-5 bg-[#ff0055]/5 rounded-2xl border border-[#ff0055]/20 hover:border-[#ff0055]/50 transition-all mb-4"
                                    >
                                        <div>
                                            <p className="text-white font-oswald uppercase italic text-sm">Testar Conexão Make</p>
                                            <p className="text-[9px] text-[#ff0055] font-mono uppercase tracking-widest">Enviar sinal de teste para o WhatsApp</p>
                                        </div>
                                        <span className="text-[#ff0055] font-black text-xl">{loading ? '⌛' : '🛰️'}</span>
                                    </button>

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

                                    {/* MODO TREINO TOGGLE */}
                                    <div className={`mt-4 p-5 rounded-2xl border transition-all ${isTrainingMode ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'bg-black/40 border-neutral-800'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className={`font-oswald uppercase italic text-sm ${isTrainingMode ? 'text-yellow-500' : 'text-white'}`}>Modo Treino (Sandbox)</p>
                                                <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest">Ativar ambiente de teste seguro</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const next = !isTrainingMode;
                                                    setIsTrainingMode(next);
                                                    if (next) {
                                                        // Importar MOCK_PLAYERS se necessário, mas o types.ts não os tem. 
                                                        // Eles estão no MatchControl. Vou precisar movê-los ou duplicá-los. Melhor mover para constants.ts?
                                                        // Para agora vou usar uma estratégia de IDs fixos se eu não quiser mover.
                                                        // Mas o MatchControl já tem MOCK_PLAYERS.
                                                        setTrainingConfirmedIds(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15']);
                                                    } else {
                                                        setTrainingConfirmedIds([]);
                                                    }
                                                }}
                                                className={`w-14 h-7 rounded-full p-1 transition-all ${isTrainingMode ? 'bg-yellow-500' : 'bg-neutral-800'}`}
                                            >
                                                <div className={`w-5 h-5 bg-black rounded-full transition-all ${isTrainingMode ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>
                                        {isTrainingMode && (
                                            <p className="mt-3 text-[10px] text-yellow-500/70 font-mono leading-relaxed italic">
                                                ⚠️ ATENÇÃO: Enquanto o Modo Treino estiver ativo, o Controle de Pelada usará jogadores fictícios e NADA será salvo no banco.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <div className="pt-12 text-center">
                                <div className="inline-block p-4 border border-dashed border-neutral-800 rounded-2xl">
                                    <p className="text-[8px] font-mono text-neutral-700 uppercase tracking-[0.5em] font-black">BALAIO DE GATO FC • v1.0</p>
                                    <p className="text-[8px] font-mono text-neutral-800 uppercase tracking-widest mt-2">Sessão Ativa: {currentSession?.id || 'NENHUMA'}</p>
                                    <p className="text-[7px] font-mono text-neutral-900 uppercase mt-4 opacity-50">Feito para o Balaio de Gato FC</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >

            {/* MODAL DE BADGES PREMIUM */}
            {
                (() => {
                    const activePlayer = players.find(p => p.id === selectedPlayerForBadge?.id);
                    if (!activePlayer) return null;

                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="w-full max-w-4xl max-h-[90vh] glass-panel border border-white/10 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(220,38,38,0.2)]">
                                {/* Header do Modal */}
                                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-red-950/20 to-transparent">
                                    <div className="flex items-center gap-4">
                                        <img src={activePlayer.photo} className="w-16 h-16 rounded-full border-2 border-red-600 object-cover shadow-[0_0_20px_rgba(185,28,28,0.5)]" />
                                        <div>
                                            <h4 className="font-oswald text-2xl font-black uppercase italic tracking-tighter text-white">PORTFÓLIO DE BADGES</h4>
                                            <p className="text-xs font-mono text-red-500 uppercase tracking-widest">Atleta: {activePlayer.nickname}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedPlayerForBadge(null)} className="text-neutral-500 hover:text-white transition-colors text-2xl">✕</button>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                                    {/* Badges Atuais */}
                                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 p-6 bg-black/40 overflow-y-auto custom-scrollbar">
                                        <h5 className="text-[10px] font-black uppercase text-neutral-500 mb-4 tracking-[0.3em]">Badges Ativas ({activePlayer.badges.length})</h5>
                                        <div className="space-y-2">
                                            {activePlayer.badges.length === 0 ? (
                                                <div className="p-8 text-center border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center gap-2">
                                                    <span className="text-3xl grayscale opacity-20">💩</span>
                                                    <p className="text-[10px] text-neutral-600 uppercase font-bold italic text-center">Nenhuma honraria registrada ainda.</p>
                                                </div>
                                            ) : (
                                                selectedPlayerByBadges(activePlayer.badges).map(badge => (
                                                    <div key={badge.id} className="group flex items-center justify-between bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl hover:border-red-900/50 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xl">{badge.icon.startsWith('/') ? <img src={badge.icon} className="w-6 h-6 rounded-full object-cover" /> : badge.icon}</span>
                                                            <div>
                                                                <p className="text-[10px] font-black text-white uppercase italic">{badge.name}</p>
                                                                <p className="text-[8px] text-neutral-600 uppercase">{badge.category}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleGiveBadge(activePlayer.id, badge.id)}
                                                            className="text-[10px] text-neutral-700 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                        >REMOVER</button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Seleção de Novas Badges */}
                                    <div className="flex-1 flex flex-col bg-neutral-950/50">
                                        {/* Filtros e Busca */}
                                        <div className="p-6 space-y-4 border-b border-white/5">
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
                                                <input
                                                    type="text"
                                                    placeholder="BUSCAR BADGE (EX: ARTILHEIRO, MATADOR...)"
                                                    value={badgeSearch}
                                                    onChange={(e) => setBadgeSearch(e.target.value)}
                                                    className="w-full bg-black border border-neutral-800 p-4 pl-12 text-sm text-white font-oswald uppercase italic rounded-2xl focus:border-red-600 outline-none transition-all placeholder:text-neutral-700"
                                                />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                {['Todas', 'Elite', 'Geral', 'Linha', 'Goleiro', 'Architect', 'Bagre'].map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => setSelectedBadgeCategory(cat)}
                                                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${selectedBadgeCategory === cat ? 'bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Grid de Badges */}
                                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-3 custom-scrollbar">
                                            {filteredBadges().map(badge => {
                                                const isOwned = activePlayer.badges.includes(badge.id);
                                                return (
                                                    <button
                                                        key={badge.id}
                                                        onClick={() => handleGiveBadge(activePlayer.id, badge.id)}
                                                        className={`relative p-4 rounded-2xl border transition-all text-left flex flex-col gap-2 group ${isOwned ? 'bg-red-900/10 border-red-600/40 opacity-40 grayscale pointer-events-none' : 'bg-neutral-900 border-neutral-800 hover:border-red-900/50 hover:-translate-y-1 shadow-lg'}`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-2xl group-hover:scale-125 transition-transform duration-500">{badge.icon.startsWith('/') ? <img src={badge.icon} className="w-8 h-8 rounded-full object-cover" /> : badge.icon}</span>
                                                            <span className="text-[8px] font-mono font-black py-0.5 px-2 rounded-full border border-neutral-800 text-neutral-600 group-hover:border-neutral-600 group-hover:text-neutral-400">{badge.category}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-white uppercase italic leading-tight mb-1">{badge.name}</p>
                                                            <p className="text-[8px] text-neutral-600 italic line-clamp-2 leading-tight">"{badge.description}"</p>
                                                        </div>
                                                        {isOwned && <span className="absolute top-2 right-2 text-red-500 text-[8px] font-black">JÁ POSSUI</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 border-t border-white/5 bg-neutral-900/40 flex justify-end gap-3">
                                    <button
                                        onClick={() => setSelectedPlayerForBadge(null)}
                                        className="px-8 py-3 bg-white text-black font-oswald font-black uppercase italic text-sm tracking-widest hover:bg-red-600 hover:text-white transition-all rounded-xl"
                                    >
                                        FECHAR PORTFÓLIO
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
        </div >
    );
};

export default AdminPanel;
