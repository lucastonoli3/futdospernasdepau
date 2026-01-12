
import React, { useState, useRef, useEffect } from 'react';
import { Player, Position, PlayerStatus } from '../types';
import { geminiService } from '../services/geminiService';
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
      text: '⚠️ Grupo "FUT DOS PERNAS DE PAU" criado. Proibido cobrar dívida aqui.',
      isMe: false,
      avatar: '',
      timestamp: getResenhaDate(),
      role: 'SYSTEM'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkChurrasConfirmation();

    // Simplesmente para manter o scroll
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, currentUser.id]);

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

  const handleSend = async (e: React.FormEvent) => {
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

    // Resposta Aleatória da IA
    if (Math.random() > 0.4) {
      setTimeout(() => setIsTyping('Alguém'), 1000);

      const delay = 3000 + Math.random() * 2000;
      const responder = allPlayers[Math.floor(Math.random() * allPlayers.length)];

      try {
        const responderStats = `Posição: ${responder.position}, Moral: ${responder.moralScore}`;
        const replyText = await geminiService.generatePlayerReply(
          currentInput,
          currentUser.nickname,
          responder.nickname,
          responderStats
        );

        setTimeout(() => {
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            senderName: responder.nickname,
            text: replyText || '👀',
            isMe: false,
            avatar: responder.photo,
            timestamp: getResenhaDate()
          };
          setMessages(prev => [...prev, aiMsg]);
          setIsTyping(null);
        }, delay);
      } catch (error) {
        setIsTyping(null);
      }
    }
  };

  const handleRoast = async () => {
    setIsTyping('Narrador Bagre');
    const randomVictim = allPlayers[Math.floor(Math.random() * allPlayers.length)];

    try {
      const stats = `Mancadas: ${randomVictim.worstVotes}, Gols: ${randomVictim.goals}, Moral: ${randomVictim.moralScore}`;
      const roast = await geminiService.generateWorstPlayerText(randomVictim.nickname, stats);

      const aiMsg: Message = {
        id: (Date.now() + 2).toString(),
        senderName: 'NARRADOR',
        text: roast || 'Tô sem palavras pra tanta ruindade.',
        isMe: false,
        avatar: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png',
        timestamp: getResenhaDate(),
        role: 'SYSTEM'
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(null);
    }
  };

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-[#0b141a] rounded-sm border border-neutral-800 overflow-hidden shadow-2xl relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">

      {/* BANNER CHURRASCO MENSAL */}
      {isLastMondayOfMonth() && (
        <div className="bg-[#1c1c1c] border-b border-yellow-600/30 p-4 flex items-center justify-between animate-in slide-in-from-top duration-700">
          <div className="flex items-center gap-4">
            <span className="text-3xl filter grayscale brightness-125">🍖</span>
            <div>
              <p className="text-yellow-500 font-oswald font-black uppercase tracking-widest text-lg italic">Resenha do Mês (Churrasco)</p>
              <p className="text-[10px] text-neutral-500 font-mono uppercase font-bold tracking-tighter">Última segunda do mês: <span className="text-white">R$ 15,00 MANDATÓRIO</span></p>
            </div>
          </div>
          <button
            onClick={handleConfirmChurras}
            disabled={isConfirmed}
            className={`${isConfirmed ? 'bg-green-900/50 text-green-500' : 'bg-red-800 text-white hover:bg-black'} py-1 px-4 font-oswald text-[10px] uppercase font-bold transition-all border border-red-700 disabled:border-green-900`}
          >
            {isConfirmed ? 'Presença Confirmada✓' : 'Confirmar Presença (R$ 15)'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#202c33] p-3 border-b border-[#2f3b43] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center border border-white/10 overflow-hidden">
            <span className="text-xl">⚽</span>
          </div>
          <div className="flex flex-col">
            <h3 className="text-white font-bold text-sm truncate uppercase tracking-tighter">FUT DOS PERNAS DE PAU 🔪</h3>
            <p className="text-[9px] text-[#8696a0] font-mono uppercase tracking-widest">Grupo Oficial da Resenha</p>
          </div>
        </div>
        <button onClick={handleRoast} className="p-2 hover:bg-white/5 rounded-full text-red-600 transition-all active:scale-95" title="Pedir Roast ao Narrador">
          🔥 Roast
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/80">
        {messages.map((msg) => {
          if (msg.role === 'SYSTEM') {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span className="bg-[#182229] text-[#ffd279] text-[10px] px-3 py-1 rounded-lg uppercase font-bold tracking-wider shadow-sm border border-yellow-900/30">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group mb-1`}>
              <div className={`flex max-w-[80%] ${msg.isMe ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
                {!msg.isMe && (
                  <img src={msg.avatar || 'https://via.placeholder.com/150'} className="w-8 h-8 rounded-full border border-neutral-700 object-cover mt-1" alt={msg.senderName} />
                )}
                <div className={`rounded-lg px-3 py-1.5 relative shadow-sm ${msg.isMe ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'}`}>
                  {!msg.isMe && (
                    <p className={`text-[11px] font-bold mb-0.5 leading-tight`} style={{ color: stringToColor(msg.senderName) }}>
                      {msg.senderName}
                    </p>
                  )}
                  <div className="text-sm whitespace-pre-wrap leading-snug relative pr-14 pb-1">
                    {msg.text}
                    <span className="text-[10px] text-[#8696a0] absolute bottom-0 right-0 min-w-[30px] text-right font-mono">
                      {msg.timestamp} {msg.isMe && <span className="text-[#53bdeb]">✓✓</span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start ml-10">
            <div className="text-[#8696a0] text-[10px] italic font-mono animate-pulse uppercase">
              {isTyping} tá digitando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="bg-[#202c33] p-2 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mande sua asneira..."
          className="flex-1 bg-[#2a3942] text-[#d1d7db] text-sm rounded-lg px-4 py-2 focus:outline-none border border-transparent focus:border-red-900 transition-all font-mono"
        />
        <button type="submit" className="bg-red-800 p-2 rounded-full text-white hover:bg-black transition-all active:scale-95 shadow-lg">
          🚀
        </button>
      </form>
    </div>
  );
};

export default ChatResenha;
