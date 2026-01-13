
import React, { useState, useRef, useEffect } from 'react';
import { Player, Position, PlayerStatus } from '../types';
import { aiService } from '../services/geminiService';
import { getResenhaDate, isLastMondayOfMonth, supabase } from '../services/supabaseClient';

interface Message {
  id: string;
  senderName: string;
  text: string;
  isMe: boolean;
  avatar: string;
  timestamp: string;
  role?: string;
}

interface ChatResenhaProps {
  currentUser: Player;
  allPlayers: Player[];
}

const ChatResenha: React.FC<ChatResenhaProps> = ({ currentUser, allPlayers }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderName: 'SISTEMA',
      text: '⚠️ Mural de FEITOS & HUMILHAÇÕES. Relate o que aconteceu e aguarde o Tribunal.',
      isMe: false,
      avatar: '',
      timestamp: getResenhaDate(),
      role: 'SYSTEM'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [featType, setFeatType] = useState('caneta');
  const [victimId, setVictimId] = useState('');
  const [featDescription, setFeatDescription] = useState('');
  const [confirmedFeats, setConfirmedFeats] = useState<any[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkChurrasConfirmation();
    fetchConfirmedFeats();

    // Inscrição em tempo real para Humilhações
    const hSub = supabase
      .channel('public:humiliations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'humiliations' }, () => {
        fetchConfirmedFeats();
      })
      .subscribe();

    return () => { hSub.unsubscribe(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, confirmedFeats]);

  const fetchConfirmedFeats = async () => {
    const { data } = await supabase
      .from('humiliations')
      .select('*')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true });

    if (data) setConfirmedFeats(data);
  };

  const checkChurrasConfirmation = async () => {
    const monthYear = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from('resenha_confirmations')
      .select('id')
      .eq('player_id', currentUser.id)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (data) setIsConfirmed(true);
  };

  const handleConfirmChurras = async () => {
    if (isConfirmed) return;
    try {
      const monthYear = new Date().toISOString().slice(0, 7);
      const { error: cError } = await supabase
        .from('resenha_confirmations')
        .insert([{ player_id: currentUser.id, month_year: monthYear }]);

      if (cError) throw cError;

      const { error: dError } = await supabase
        .from('players')
        .update({ debt: (currentUser.debt || 0) + 15, is_paid: false })
        .eq('id', currentUser.id);

      if (dError) throw dError;

      setIsConfirmed(true);
      alert("CONFIRMADO! R$ 15 debitados na sua conta. Não adianta fugir.");
    } catch (e) {
      console.error(e);
      alert("Erro ao confirmar. Talvez o banco esteja de ressaca.");
    }
  };

  const handleSubmitFeat = async () => {
    if (!victimId || !featDescription) return;

    try {
      const { error } = await supabase.from('humiliations').insert([{
        performer_id: currentUser.id,
        victim_id: victimId,
        type: featType,
        description: featDescription,
        status: 'pending'
      }]);

      if (error) throw error;

      alert("FEITO REPORTADO! Agora aguarde a revisão do Admin para a moral subir (ou cair).");
      setShowReportForm(false);
      setVictimId('');
      setFeatDescription('');
    } catch (e) {
      console.error(e);
      alert("Erro ao reportar. Tenta depois.");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    // ... logic for chat messages (kept identical for commentary)
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      senderName: currentUser.nickname,
      text: input,
      isMe: true,
      avatar: currentUser.photo,
      timestamp: getResenhaDate()
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');

    if (Math.random() > 0.4) {
      setIsTyping('Alguém');
      const responder = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      try {
        const stats = `Posição: ${responder.position}, Moral: ${responder.moralScore}`;
        const replyText = await aiService.generatePlayerReply(currentInput, currentUser.nickname, responder.nickname, stats);
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            senderName: responder.nickname,
            text: replyText || '👀',
            isMe: false,
            avatar: responder.photo,
            timestamp: getResenhaDate()
          }]);
          setIsTyping(null);
        }, 1500);
      } catch (e) { setIsTyping(null); }
    }
  };

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  const otherPlayers = allPlayers.filter(p => p.id !== currentUser.id);

  return (
    <div className="flex flex-col h-[650px] w-full max-w-4xl mx-auto bg-black rounded-sm border border-neutral-800 overflow-hidden shadow-2xl relative">

      {/* Header com Relatar Feito */}
      <div className="bg-neutral-900 p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🏆</span>
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-tighter">MURAL DE FEITOS</h3>
            <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest">A glória e a vergonha imortalizadas</p>
          </div>
        </div>
        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 font-oswald text-xs uppercase font-bold transition-all border border-red-900 italic"
        >
          {showReportForm ? 'Cancelar' : 'Relatar Feito'}
        </button>
      </div>

      {/* Form de Relatar Feito */}
      {showReportForm && (
        <div className="bg-neutral-900 border-b border-red-900/30 p-4 space-y-4 animate-in slide-in-from-top duration-300">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] text-neutral-500 uppercase font-black block mb-1">O que você fez?</label>
              <select
                value={featType}
                onChange={(e) => setFeatType(e.target.value)}
                className="w-full bg-black border border-neutral-800 p-2 text-white font-oswald text-xs uppercase outline-none focus:border-red-700"
              >
                <option value="caneta">Dê uma Caneta</option>
                <option value="chapeu">Dê um Chapéu</option>
                <option value="dibre">Dibre Humilhante</option>
                <option value="gol_placa">Gol de Placa</option>
                <option value="vexame">Vi um Vexame</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-neutral-500 uppercase font-black block mb-1">Vítima (Quem tomou?)</label>
              <select
                value={victimId}
                onChange={(e) => setVictimId(e.target.value)}
                className="w-full bg-black border border-neutral-800 p-2 text-white font-oswald text-xs uppercase outline-none focus:border-red-700"
              >
                <option value="">Escolha a vítima...</option>
                {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] text-neutral-500 uppercase font-black block mb-1">Relato dos Fatos</label>
            <textarea
              value={featDescription}
              onChange={(e) => setFeatDescription(e.target.value)}
              placeholder="Ex: Deixei o cara no chão e saí rindo..."
              className="w-full bg-black border border-neutral-800 p-2 text-white font-mono text-[10px] outline-none focus:border-red-700 h-20 resize-none"
            />
          </div>
          <button
            onClick={handleSubmitFeat}
            disabled={!victimId || !featDescription}
            className="w-full bg-white text-black py-2 font-oswald font-black uppercase text-xs hover:bg-red-700 hover:text-white transition-all disabled:opacity-20"
          >
            Protocolar Feito para Revisão
          </button>
        </div>
      )}

      {/* Feed misto: Feitos + Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/50">

        {/* Banner Churras Coisas (se ativo) */}
        {isLastMondayOfMonth() && !showReportForm && (
          <div className="bg-neutral-900 border border-yellow-900/30 p-3 flex items-center justify-between mb-4">
            <p className="text-yellow-500 font-oswald text-xs uppercase italic">Resenha Mensal Ativa!</p>
            <button
              onClick={handleConfirmChurras}
              disabled={isConfirmed}
              className="text-[9px] bg-yellow-900/20 text-yellow-500 border border-yellow-700 px-2 py-1 uppercase font-black"
            >
              {isConfirmed ? 'Confirmado✓' : 'Confirmar Presença'}
            </button>
          </div>
        )}

        {/* MENSAGENS E FEITOS */}
        {[...messages, ...confirmedFeats.map(f => ({
          id: f.id,
          type: 'FEITO',
          performer: allPlayers.find(p => p.id === f.performer_id),
          victim: allPlayers.find(p => p.id === f.victim_id),
          featType: f.type,
          desc: f.description,
          date: f.created_at
        }))].sort((a: any, b: any) => {
          const timeA = a.type === 'FEITO' ? new Date(a.date).getTime() : parseInt(a.id);
          const timeB = b.type === 'FEITO' ? new Date(b.date).getTime() : parseInt(b.id);
          return timeA - timeB;
        }).map((item: any) => {
          if (item.role === 'SYSTEM') {
            return (
              <div key={item.id} className="flex justify-center">
                <span className="bg-neutral-800 text-neutral-400 text-[9px] px-3 py-1 font-mono uppercase tracking-widest border border-neutral-700">
                  {item.text}
                </span>
              </div>
            );
          }

          if (item.type === 'FEITO') {
            return (
              <div key={item.id} className="bg-neutral-900/50 border-l-4 border-yellow-600 p-3 animate-in fade-in zoom-in">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src={item.performer?.photo} className="w-8 h-8 rounded-full border border-yellow-600" />
                    <span className="text-white font-oswald text-sm uppercase">{item.performer?.nickname}</span>
                    <span className="text-yellow-600 font-black italic text-xs mx-1">➜ {item.featType.toUpperCase()} ➜</span>
                    <span className="text-neutral-400 font-oswald text-xs uppercase">{item.victim?.nickname}</span>
                  </div>
                  <span className="text-yellow-600 font-black text-xs">CONFIRMADO</span>
                </div>
                <p className="text-neutral-300 text-xs font-mono italic">"{item.desc}"</p>
              </div>
            );
          }

          return (
            <div key={item.id} className={`flex ${item.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] ${item.isMe ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
                {!item.isMe && (
                  <img src={item.avatar} className="w-6 h-6 rounded-full grayscale mt-1" alt="" />
                )}
                <div className={`rounded-lg px-3 py-2 ${item.isMe ? 'bg-neutral-800 text-white' : 'bg-neutral-900 text-neutral-300'} border border-neutral-800`}>
                  {!item.isMe && (
                    <p className="text-[10px] font-black uppercase mb-1" style={{ color: stringToColor(item.senderName) }}>
                      {item.senderName}
                    </p>
                  )}
                  <p className="text-xs whitespace-pre-wrap">{item.text}</p>
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="text-[9px] text-neutral-600 font-mono animate-pulse uppercase ml-8">
            {isTyping} tá digitando asneira...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="bg-neutral-900 p-3 flex items-center gap-2 border-t border-neutral-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Comente as humilhações..."
          className="flex-1 bg-black text-white text-xs rounded-none px-4 py-2 focus:outline-none border border-neutral-800 focus:border-red-900 transition-all font-mono"
        />
        <button type="submit" className="bg-white text-black p-2 hover:bg-red-700 hover:text-white transition-all">
          🚀
        </button>
      </form>
    </div>
  );
};

export default ChatResenha;
