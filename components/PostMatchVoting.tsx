
import React, { useState, useEffect } from 'react';
import { Player, MatchSession } from '../types';
import { supabase } from '../services/supabaseClient';

interface PostMatchVotingProps {
    players: Player[];
    currentUser: Player;
    currentSession: MatchSession;
    onSubmit: (bestId: string, worstId: string) => void;
}

const PostMatchVoting: React.FC<PostMatchVotingProps> = ({ players, currentUser, currentSession, onSubmit }) => {
    const [bestId, setBestId] = useState<string | null>(null);
    const [worstId, setWorstId] = useState<string | null>(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [checking, setChecking] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [results, setResults] = useState<{ best: Player | null, worst: Player | null } | null>(null);
    const [timeLeft, setTimeLeft] = useState("");
    const [countdownLabel, setCountdownLabel] = useState("");

    useEffect(() => {
        // Inicializa o estado imediatamente para evitar piscar tela de fechado
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [currentSession.status, currentSession.votingOpen]);

    const updateCountdown = () => {
        const now = new Date();
        const matchDay = currentSession.matchDay ?? 1;

        // PRIORIDADE MÁXIMA: Se o servidor diz que a votação está aberta, ABRA.
        if (currentSession.votingOpen) {
            setIsLocked(false);
            setCountdownLabel("VOTAÇÃO LIBERADA");
            setTimeLeft("VOTE AGORA!");
            return;
        }

        const votingPossibleStatuses = ['partida', 'votacao_aberta', 'em_jogo', 'finalizado'];
        const canVoteByStatus = votingPossibleStatuses.includes(currentSession.status);

        if (!canVoteByStatus) {
            setIsLocked(true);
            setCountdownLabel("Início da Partida (20:15)");

            const target = new Date();
            const daysToMatch = (matchDay - now.getDay() + 7) % 7;
            target.setDate(now.getDate() + daysToMatch);
            target.setHours(20, 15, 0, 0);

            const diff = target.getTime() - now.getTime();
            formatTime(diff > 0 ? diff : 0);
        } else {
            setCountdownLabel("Urnas fecham em:");

            const deadline = new Date();
            const daysToMatch = (matchDay - now.getDay() - 7) % 7;
            deadline.setDate(now.getDate() + daysToMatch + 4);
            deadline.setHours(23, 59, 59, 999);

            const diff = deadline.getTime() - now.getTime();
            if (diff <= 0) {
                setIsLocked(true);
                formatTime(0);
            } else {
                setIsLocked(false);
                formatTime(diff);
            }
        }
    };

    const formatTime = (diff: number) => {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };

    useEffect(() => {
        checkVoteStatus();
        fetchResults(); // Sempre busca resultados para mostrar no modo bloqueado
    }, [currentUser.nickname]);

    const fetchResults = async () => {
        // Buscar todos os votos para encontrar o match_id mais recente
        const { data: allVotes } = await supabase.from('votes').select('match_id, best_voted_id, worst_voted_id');
        if (!allVotes || allVotes.length === 0) return;

        // Agrupar por match_id e pegar o último
        const matchIds = Array.from(new Set(allVotes.map(v => v.match_id))).sort().reverse();
        const latestMatchId = matchIds[0];
        const latestVotes = allVotes.filter(v => v.match_id === latestMatchId);

        const bestCounts: any = {};
        const worstCounts: any = {};

        latestVotes.forEach((v: any) => {
            bestCounts[v.best_voted_id] = (bestCounts[v.best_voted_id] || 0) + 1;
            worstCounts[v.worst_voted_id] = (worstCounts[v.worst_voted_id] || 0) + 1;
        });

        const bestId = Object.keys(bestCounts).reduce((a, b) => bestCounts[a] > bestCounts[b] ? a : b);
        const worstId = Object.keys(worstCounts).reduce((a, b) => worstCounts[a] > worstCounts[b] ? a : b);

        setResults({
            best: players.find(p => p.id === bestId) || null,
            worst: players.find(p => p.id === worstId) || null
        });
    };

    useEffect(() => {
        checkVoteStatus();
    }, [currentUser.nickname]);

    const checkVoteStatus = async () => {
        try {
            // Match ID baseado na última segunda-feira LOCAL
            const now = new Date();
            const matchDay = currentSession.matchDay ?? 1;
            const lastMatch = new Date(now);
            const diff = (now.getDay() - matchDay + 7) % 7;
            lastMatch.setDate(now.getDate() - diff);

            const year = lastMatch.getFullYear();
            const month = String(lastMatch.getMonth() + 1).padStart(2, '0');
            const day = String(lastMatch.getDate()).padStart(2, '0');
            const matchId = `${year}-${month}-${day}`;

            const { data, error } = await supabase
                .from('votes')
                .select('id')
                .eq('voter_nickname', currentUser.nickname)
                .eq('match_id', matchId)
                .maybeSingle();

            if (data) setHasVoted(true);
        } catch (err) {
            console.error(err);
        } finally {
            setChecking(false);
        }
    };

    const canSubmit = bestId && worstId && bestId !== worstId;

    if (checking) return (
        <div className="flex flex-col items-center justify-center p-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-red-900 border-t-red-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-neutral-500 font-mono text-[10px] uppercase tracking-widest">Consultando as Urnas...</p>
        </div>
    );

    if (isLocked) return (
        <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-4">
                <div className="inline-block px-4 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Urnas Lacradas
                </div>
                <h2 className="text-6xl font-oswald font-black text-white italic tracking-tighter uppercase">Votação Encerrada</h2>
                <p className="text-neutral-500 font-mono text-xs uppercase">A democracia dorme. O veredito foi dado.</p>
            </div>

            {results && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10">
                    {/* DESTAQUE MELHOR */}
                    <div className="relative group overflow-hidden border-2 border-yellow-600 bg-yellow-950/10 p-8 text-center transition-all hover:scale-105">
                        <div className="absolute top-0 right-0 p-2 bg-yellow-600 text-black font-black text-[10px] uppercase">O Cara</div>
                        <span className="text-6xl block mb-4">👑</span>
                        <h3 className="text-2xl font-oswald font-black text-white uppercase italic">{results.best?.nickname}</h3>
                        <p className="text-yellow-500 font-mono text-[9px] font-bold uppercase mt-2">Craque da Partida</p>
                        <img src={results.best?.photo} className="w-32 h-32 mx-auto mt-6 border-2 border-yellow-600 object-cover grayscale-0" alt="Melhor" />
                    </div>

                    {/* DESTAQUE BAGRE */}
                    <div className="relative group overflow-hidden border-2 border-red-600 bg-red-950/20 p-8 text-center transition-all hover:scale-105">
                        <div className="absolute top-0 right-0 p-2 bg-red-600 text-white font-black text-[10px] uppercase">Lixo da Rodada</div>
                        <span className="text-6xl block mb-4">🤢</span>
                        <h3 className="text-2xl font-oswald font-black text-white uppercase italic">{results.worst?.nickname}</h3>
                        <p className="text-red-600 font-mono text-[9px] font-bold uppercase mt-2">O Bagre Supremo</p>
                        <img src={results.worst?.photo} className="w-32 h-32 mx-auto mt-6 border-2 border-red-600 object-cover grayscale" alt="Pior" />
                    </div>
                </div>
            )}

            <div className="mt-20 p-10 bg-neutral-900 border border-neutral-800 text-center space-y-4">
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.5em]">{countdownLabel}</p>
                <div className="text-5xl font-oswald font-black text-red-600 tabular-nums tracking-widest animate-pulse">
                    {timeLeft}
                </div>
            </div>
        </div>
    );

    if (hasVoted) return (
        <div className="max-w-2xl mx-auto p-12 text-center border-2 border-dashed border-neutral-900 bg-neutral-900/10 rounded-sm">
            <span className="text-5xl block mb-6 filter grayscale">🗳️</span>
            <h2 className="text-3xl font-oswald font-black text-white uppercase italic tracking-tighter">DEVER CUMPRIDO</h2>
            <p className="text-neutral-500 font-mono text-xs uppercase mt-4">Você já votou nesta rodada. Aguarde o resultado final no mural da vergonha.</p>
            <p className="text-[10px] text-red-900 font-black mt-8 uppercase tracking-widest">A democracia não falha (pelo menos hoje).</p>
        </div>
    );

    const bestPlayersList = players.filter(p => p.id !== currentUser.id);

    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
            <div className="text-center space-y-2">
                <h2 className="text-5xl font-oswald font-black text-white italic tracking-tighter uppercase underline decoration-red-600">Veredito da Noite</h2>
                <p className="text-neutral-500 font-mono text-xs uppercase tracking-[0.4em]">Sua voz, sua sentença. Não tem volta.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* MELHOR DA PARTIDA */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">🌟</span>
                        <h3 className="text-xl font-oswald font-bold text-yellow-500 uppercase italic">Bola de Ouro</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {bestPlayersList.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setBestId(p.id)}
                                className={`flex items-center gap-4 p-3 border transition-all ${bestId === p.id ? 'bg-yellow-600/20 border-yellow-600 translate-x-2' : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'}`}
                            >
                                <img src={p.photo} className="w-10 h-10 object-cover" alt={p.nickname} />
                                <span className="font-oswald uppercase text-lg text-white">{p.nickname}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* BAGRE DA PARTIDA */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">🤢</span>
                        <h3 className="text-xl font-oswald font-bold text-red-600 uppercase italic">Bagre da Rodada</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {players.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setWorstId(p.id)}
                                className={`flex items-center gap-4 p-3 border transition-all ${worstId === p.id ? 'bg-red-900/20 border-red-600 translate-x-2' : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'}`}
                            >
                                <img src={p.photo} className="w-10 h-10 object-cover" alt={p.nickname} />
                                <span className="font-oswald uppercase text-lg text-white">{p.nickname}</span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            <div className="pt-12 text-center pb-24">
                <button
                    onClick={() => bestId && worstId && onSubmit(bestId, worstId)}
                    disabled={!canSubmit}
                    className="bg-red-700 hover:bg-red-800 disabled:opacity-20 disabled:grayscale text-white font-black font-oswald text-4xl py-6 px-16 shadow-[0_0_30px_rgba(185,28,28,0.4)] transition-all uppercase tracking-tighter italic"
                >
                    Confirmar Sentença
                </button>
                {bestId === worstId && bestId && (
                    <p className="text-red-600 text-[10px] font-mono mt-4 uppercase font-black">Tu é bipolar? Escolha jogadores diferentes, gênio.</p>
                )}

                <div className="mt-20 opacity-50">
                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.3em] mb-2">As urnas serão lacradas em breve.</p>
                    <div className="text-xl font-oswald font-black text-neutral-400 tabular-nums">
                        Tempo Restante: {timeLeft}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostMatchVoting;
