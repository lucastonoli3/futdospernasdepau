
import React, { useState, useRef, useEffect } from 'react';
import { Player } from '../types';
import { getResenhaDate, isLastMondayOfMonth, supabase } from '../services/supabaseClient';

interface PersistentMessage {
  id: string;
  sender_name: string;
  text: string;
  avatar: string;
  created_at: string;
}

interface ChatResenhaProps {
  currentUser: Player;
  allPlayers: Player[];
}

const ChatResenha: React.FC<ChatResenhaProps> = ({ currentUser, allPlayers }) => {
  const [persistentMessages, setPersistentMessages] = useState<PersistentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [featType, setFeatType] = useState('caneta');
  const [victimId, setVictimId] = useState('');
  const [featDescription, setFeatDescription] = useState('');
  const [confirmedFeats, setConfirmedFeats] = useState<any[]>([]);

  // Estados para Menções (@)
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();

    // Inscrição em tempo real para Humilhações e Mensagens
    const hSub = supabase
      .channel('resenha_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'humiliations' }, () => {
        fetchConfirmedFeats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resenha_messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { hSub.unsubscribe(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [persistentMessages, confirmedFeats]);

  const fetchData = async () => {
    checkChurrasConfirmation();
    fetchConfirmedFeats();
    fetchMessages();
  };

  const fetchMessages = async () => {
    try {
      const { data } = await supabase
        .from('resenha_messages')
        .select('*, players(nickname, photo)')
        .order('created_at', { ascending: true });

      if (data) {
        setPersistentMessages(data.map(m => ({
          id: m.id,
          sender_name: m.players?.nickname || 'FDP',
          text: m.text,
          avatar: m.players?.photo || '',
          created_at: m.created_at
        })));
      }
    } catch (e) {
      console.warn("Tabela resenha_messages não encontrada. Crie-a no Supabase Dashboard.");
    }
  };

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
      await supabase.from('resenha_confirmations').insert([{ player_id: currentUser.id, month_year: monthYear }]);
      await supabase.from('players').update({ debt: (currentUser.debt || 0) + 15, is_paid: false }).eq('id', currentUser.id);
      setIsConfirmed(true);
      alert("CONFIRMADO!");
    } catch (e) { alert("Erro ao confirmar."); }
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

      alert("FEITO REPORTADO! Agora aguarde a revisão do Admin para a moral subir.");
      setShowReportForm(false);
      setVictimId('');
      setFeatDescription('');
    } catch (e) {
      alert("Erro ao reportar.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setInput(value);
    setCursorPos(position);

    const textBeforeCursor = value.substring(0, position);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1 && (lastAt === 0 || textBeforeCursor[lastAt - 1] === ' ')) {
      const query = textBeforeCursor.substring(lastAt + 1);
      if (!query.includes(' ')) {
        setMentionSearch(query);
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
  };

  const selectMention = (player: Player) => {
    const lastAt = input.lastIndexOf('@', cursorPos - 1);
    const before = input.substring(0, lastAt);
    const after = input.substring(cursorPos);
    const newValue = `${before}@${player.nickname} ${after}`;
    setInput(newValue);
    setShowMentionList(false);
    inputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      const { error } = await supabase.from('resenha_messages').insert([{
        player_id: currentUser.id,
        text: input.trim()
      }]);

      if (error) throw error;
      setInput('');
    } catch (e) {
      alert("Erro ao persistir mensagem. Verifique se a tabela 'resenha_messages' existe.");
    }
  };

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  const timeline = [
    ...persistentMessages.map(m => ({ ...m, type: 'CHAT' })),
    ...confirmedFeats.map(f => ({
      id: f.id,
      type: 'FEITO',
      performer: allPlayers.find(p => p.id === f.performer_id),
      victim: allPlayers.find(p => p.id === f.victim_id),
      featType: f.type,
      desc: f.description,
      created_at: f.created_at
    }))
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const filteredPlayers = allPlayers.filter(p =>
    p.nickname.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[700px] w-full max-w-4xl mx-auto bg-black rounded-sm border border-neutral-800 overflow-hidden shadow-2xl relative font-inter">

      {/* Mural Header */}
      <div className="bg-neutral-900 p-6 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-red-700 flex items-center justify-center rounded-sm skew-x-[-12deg] shadow-[0_0_20px_rgba(185,28,28,0.3)]">
            <span className="text-white font-black text-xl italic uppercase font-oswald -skew-x-[-12deg]">Log</span>
          </div>
          <div>
            <h3 className="text-white font-black text-lg uppercase tracking-tighter leading-none italic">Mural do Legado</h3>
            <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-[0.4em] mt-1">Registros Perpétuos da Várzea</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowReportForm(!showReportForm)}
            className="px-4 py-2 text-[10px] uppercase font-black tracking-widest border border-red-900 bg-red-700/20 text-red-500 hover:bg-red-700 hover:text-white transition-all italic"
          >
            {showReportForm ? 'Cancelar' : 'Relatar Feito'}
          </button>
          {isLastMondayOfMonth() && (
            <button
              onClick={handleConfirmChurras}
              disabled={isConfirmed}
              className={`px-4 py-2 text-[10px] uppercase font-black tracking-widest border transition-all ${isConfirmed ? 'border-neutral-800 text-neutral-600' : 'border-yellow-600 text-yellow-500 hover:bg-yellow-600 hover:text-black'}`}
            >
              {isConfirmed ? 'Churras✓' : 'Pago Churras'}
            </button>
          )}
        </div>
      </div>

      {/* Form de Relatar Feito */}
      {showReportForm && (
        <div className="bg-neutral-900 border-b border-red-900/30 p-6 space-y-4 animate-in slide-in-from-top duration-300 z-20">
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
                {allPlayers.filter(p => p.id !== currentUser.id).map(p => (
                  <option key={p.id} value={p.id}>{p.nickname}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] text-neutral-500 uppercase font-black block mb-1">Detalhes do Crime</label>
            <textarea
              value={featDescription}
              onChange={(e) => setFeatDescription(e.target.value)}
              placeholder="Descreva a humilhação..."
              className="w-full bg-black border border-neutral-800 p-2 text-white font-mono text-[10px] outline-none focus:border-red-700 h-20 resize-none"
            />
          </div>
          <button
            onClick={handleSubmitFeat}
            disabled={!victimId || !featDescription}
            className="w-full bg-white text-black py-3 font-oswald font-black uppercase text-xs hover:bg-red-700 hover:text-white transition-all disabled:opacity-20"
          >
            Protocolar Feito para Revisão
          </button>
        </div>
      )}

      {/* Feed da História */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900/20 via-black to-black no-scrollbar">
        {timeline.map((item: any) => {
          if (item.type === 'FEITO') {
            return (
              <div key={item.id} className="relative pl-12 pb-2 group animate-in slide-in-from-left duration-500">
                <div className="absolute left-4 top-0 bottom-0 w-[2px] bg-red-900/30 group-hover:bg-red-600/50 transition-colors"></div>
                <div className="absolute left-[10px] top-1 w-4 h-4 bg-black border-2 border-red-600 rounded-full z-10"></div>

                <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-sm hover:border-red-600/50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={item.performer?.photo} className="w-10 h-10 object-cover border border-red-900" />
                        <div className="absolute -bottom-1 -right-1 bg-red-600 text-[8px] font-black px-1 uppercase italic">Glória</div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-oswald text-sm uppercase tracking-tighter">{item.performer?.nickname}</span>
                        <span className="text-red-500 font-black italic text-[10px] uppercase tracking-widest">{item.featType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-neutral-600 font-mono uppercase">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] text-red-600 font-black italic uppercase">Confirmado</p>
                    </div>
                  </div>
                  <p className="text-neutral-400 text-sm font-mono italic leading-relaxed border-l-2 border-neutral-800 pl-4 py-1">
                    "{item.desc}" <span className="text-red-900 font-black not-italic ml-2">@ {item.victim?.nickname}</span>
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={item.id} className="flex flex-col space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <img src={item.avatar} className="w-5 h-5 rounded-full grayscale opacity-50" />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: stringToColor(item.sender_name) }}>
                  {item.sender_name}
                </span>
                <span className="text-[9px] text-neutral-700 font-mono">
                  {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="bg-neutral-900/20 border-l border-neutral-800 pl-4 py-1">
                <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                  {item.text.split(/(@\w+)/g).map((part: string, i: number) =>
                    part.startsWith('@') ? <span key={i} className="text-red-600 font-black italic">{part}</span> : part
                  )}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Mention Dropdown */}
      {showMentionList && filteredPlayers.length > 0 && (
        <div className="absolute bottom-20 left-6 w-64 bg-neutral-900 border border-red-900/30 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-red-950/20 p-2 border-b border-red-900/30">
            <p className="text-[9px] text-red-600 font-black uppercase tracking-widest">Escolha a Vítima / Alvo</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredPlayers.map(p => (
              <div
                key={p.id}
                onClick={() => selectMention(p)}
                className="flex items-center gap-3 p-3 hover:bg-neutral-800 cursor-pointer border-b border-neutral-800 last:border-0 transition-colors"
              >
                <img src={p.photo} className="w-6 h-6 object-cover rounded-full grayscale" />
                <span className="text-xs text-white uppercase font-oswald">{p.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input de Comentário / Feito Rápido */}
      <form onSubmit={handleSend} className="bg-neutral-900/80 p-6 flex items-center gap-4 border-t border-neutral-800 backdrop-blur-md">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Relate um feito ou comente (@alguém)..."
            className="w-full bg-black text-white text-sm px-6 py-4 focus:outline-none border-b-2 border-neutral-800 focus:border-red-700 transition-all font-mono"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-neutral-600 font-black uppercase italic tracking-widest pointer-events-none">
            Mural Perpétuo
          </div>
        </div>
        <button
          type="submit"
          className="bg-white text-black h-12 w-12 flex items-center justify-center hover:bg-red-700 hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
        >
          <span className="text-xl">✍️</span>
        </button>
      </form>
    </div>
  );
};

export default ChatResenha;
