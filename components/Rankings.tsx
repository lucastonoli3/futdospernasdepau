
import React from 'react';
import { Player } from '../types';

interface RankingsProps {
  players: Player[];
  onPlayerClick: (p: Player) => void;
}

interface RankingItemProps {
  player: Player;
  value: number;
  index: number;
  icon: string;
  onClick: (p: Player) => void;
}

const RankingItem: React.FC<RankingItemProps> = ({ player, value, index, icon, onClick }) => (
  <div
    onClick={() => onClick(player)}
    className="flex items-center justify-between p-4 bg-neutral-900/40 hover:bg-red-950/10 border border-neutral-800/50 hover:border-red-600/50 cursor-pointer transition-all mb-3 group rounded-xl backdrop-blur-sm"
  >
    <div className="flex items-center space-x-4">
      <span className="text-xs font-black text-neutral-600 w-5 font-mono">{(index + 1).toString().padStart(2, '0')}</span>
      <div className="relative">
        <img src={player.photo} className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 border border-neutral-800 group-hover:border-red-600/50 transition-all object-cover" alt={player.nickname} />
        {index === 0 && <span className="absolute -top-1 -right-1 text-[10px]">👑</span>}
      </div>
      <span className="font-oswald text-base text-neutral-300 group-hover:text-white uppercase tracking-tighter transition-colors">{player.nickname}</span>
    </div>
    <div className="flex items-center space-x-2">
      <span className="font-oswald font-black text-xl text-white group-hover:text-red-500 transition-colors">{value}</span>
      <span className="text-lg opacity-80">{icon}</span>
    </div>
  </div>
);

const Rankings: React.FC<RankingsProps> = ({ players, onPlayerClick }) => {
  const [search, setSearch] = React.useState('');

  const filteredPlayers = players.filter(p =>
    p.nickname.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const topScorers = [...filteredPlayers].sort((a, b) => b.goals - a.goals).slice(0, 5);
  const topAssists = [...filteredPlayers].sort((a, b) => b.assists - a.assists).slice(0, 5);
  const worstOfPelada = [...filteredPlayers].sort((a, b) => b.worstVotes - a.worstVotes).slice(0, 5);

  // Lógica para destaques (MVP e Bagre) considerando apenas dados válidos
  const bolaDeOuro = [...players].sort((a, b) => {
    if (b.bestVotes !== a.bestVotes) return b.bestVotes - a.bestVotes;
    return b.goals - a.goals;
  })[0];

  const bagreDaSemana = [...players].sort((a, b) => {
    if (b.worstVotes !== a.worstVotes) return b.worstVotes - a.worstVotes;
    return a.matchesPlayed - b.matchesPlayed;
  })[0];

  return (
    <div className="space-y-12 w-full animate-slide-up">
      {/* BARRA DE BUSCA PREMIUM */}
      <div className="relative max-w-2xl mx-auto group">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <span className="text-xl opacity-40 group-focus-within:opacity-100 group-focus-within:text-red-600 transition-all">🔍</span>
        </div>
        <input
          type="text"
          placeholder="PROCURAR ELEMENTO (CHAPA, NOME, VAGABUNDO)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-neutral-900/30 border border-neutral-800/50 p-5 pl-14 text-white font-oswald text-lg uppercase tracking-widest focus:border-red-600/50 focus:bg-neutral-900/50 outline-none transition-all placeholder:text-neutral-700 rounded-2xl backdrop-blur-xl"
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] bg-gradient-to-r from-transparent via-red-600 to-transparent w-0 group-focus-within:w-full transition-all duration-700"></div>
      </div>

      {search === '' && bolaDeOuro && bagreDaSemana && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2 lg:px-0">
          {/* SEÇÃO BOLA DE OURO (MVP) */}
          <section
            className="relative overflow-hidden group cursor-pointer border border-yellow-600/20 bg-neutral-900/20 rounded-[32px] transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => onPlayerClick(bolaDeOuro)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/10 via-transparent to-transparent z-0"></div>
            <div className="relative z-10 p-8 flex flex-col items-center text-center group-hover:bg-yellow-600/5 transition-all duration-700">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-yellow-500 rounded-full blur-3xl opacity-20 group-hover:opacity-40 animate-pulse transition-opacity"></div>
                <img src={bolaDeOuro.photo} className="w-28 h-28 object-cover border-4 border-yellow-600 relative z-10 shadow-[0_0_40px_rgba(234,179,8,0.3)] rounded-3xl rotate-3 group-hover:rotate-0 transition-transform duration-500" />
                <div className="absolute -top-3 -left-3 bg-yellow-600 text-black font-black font-oswald text-2xl px-3 py-1 z-20 shadow-[0_0_20px_rgba(234,179,8,0.5)] skew-x-[-12deg] italic">MVP</div>
              </div>
              <p className="text-yellow-600 font-mono text-[10px] uppercase tracking-[0.5em] mb-2 font-black">Elite da Academia</p>
              <h2 className="text-4xl font-oswald font-black text-white uppercase italic tracking-tighter leading-none group-hover:text-yellow-500 transition-colors">{bolaDeOuro.nickname}</h2>
              <p className="text-neutral-500 font-oswald text-sm uppercase mt-2 tracking-widest">Bola de Ouro da Semana</p>
              <div className="mt-6 flex gap-6 bg-black/40 px-6 py-2 rounded-full border border-yellow-600/20">
                <div className="text-center">
                  <p className="text-yellow-500 font-black font-oswald text-xl">{bolaDeOuro.bestVotes}</p>
                  <p className="text-[8px] text-neutral-500 uppercase font-mono">Votos</p>
                </div>
                <div className="w-[1px] bg-yellow-600/20"></div>
                <div className="text-center">
                  <p className="text-yellow-500 font-black font-oswald text-xl">{bolaDeOuro.goals}</p>
                  <p className="text-[8px] text-neutral-500 uppercase font-mono">Gols</p>
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO BAGRE DA SEMANA (SHAME) */}
          <section
            className="relative overflow-hidden group cursor-pointer border border-red-900/20 bg-neutral-900/20 rounded-[32px] transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => onPlayerClick(bagreDaSemana)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-transparent z-0"></div>
            <div className="relative z-10 p-8 flex flex-col items-center text-center group-hover:bg-red-900/5 transition-all duration-700">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-red-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 animate-pulse transition-opacity"></div>
                <img src={bagreDaSemana.photo} className="w-28 h-28 object-cover border-4 border-red-900 relative z-10 grayscale contrast-125 shadow-[0_0_40px_rgba(220,38,38,0.3)] rounded-3xl -rotate-3 group-hover:rotate-0 transition-transform duration-500" />
                <div className="absolute -top-3 -left-3 bg-red-900 text-white font-black font-oswald text-2xl px-3 py-1 z-20 shadow-[0_0_20px_rgba(220,38,38,0.5)] skew-x-[12deg] italic">BAGRE</div>
              </div>
              <p className="text-red-600 font-mono text-[10px] uppercase tracking-[0.5em] mb-2 font-black">Inimigo da Pelota</p>
              <h2 className="text-4xl font-oswald font-black text-white uppercase italic tracking-tighter leading-none group-hover:text-red-500 transition-colors">{bagreDaSemana.nickname}</h2>
              <p className="text-neutral-500 font-oswald text-sm uppercase mt-2 tracking-widest">O Pior da Semana</p>
              <div className="mt-6 flex gap-6 bg-black/40 px-6 py-2 rounded-full border border-red-900/20">
                <div className="text-center">
                  <p className="text-red-500 font-black font-oswald text-xl">{bagreDaSemana.worstVotes}</p>
                  <p className="text-[8px] text-neutral-500 uppercase font-mono">Crimes</p>
                </div>
                <div className="w-[1px] bg-red-900/20"></div>
                <div className="text-center">
                  <p className="text-red-500 font-black font-oswald text-xl">{bagreDaSemana.matchesPlayed}</p>
                  <p className="text-[8px] text-neutral-500 uppercase font-mono">Jogos</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2 lg:px-0">
          {/* Artilharia */}
          <section className="glass-panel p-6 rounded-[32px] premium-border">
            <h3 className="section-title text-yellow-500 mb-6 flex items-center gap-3">
              <span className="text-2xl">⚽</span> Artilharia
            </h3>
            <div className="space-y-1">
              {topScorers.map((p, idx) => (
                <RankingItem key={p.id} player={p} value={p.goals} index={idx} icon="" onClick={onPlayerClick} />
              ))}
            </div>
          </section>

          {/* Garçons */}
          <section className="glass-panel p-6 rounded-[32px] premium-border">
            <h3 className="section-title text-blue-500 mb-6 flex items-center gap-3">
              <span className="text-2xl">🎯</span> Garçons
            </h3>
            <div className="space-y-1">
              {topAssists.map((p, idx) => (
                <RankingItem key={p.id} player={p} value={p.assists} index={idx} icon="" onClick={onPlayerClick} />
              ))}
            </div>
          </section>

          {/* Inimigos da Bola */}
          <section className="glass-panel p-6 rounded-[32px] premium-border">
            <h3 className="section-title text-red-500 mb-6 flex items-center gap-3">
              <span className="text-2xl">🤢</span> Inimigos
            </h3>
            <div className="space-y-1">
              {worstOfPelada.map((p, idx) => (
                <RankingItem key={p.id} player={p} value={p.worstVotes} index={idx} icon="" onClick={onPlayerClick} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="p-20 text-center glass-panel rounded-[40px] border-dashed border-2 border-neutral-800 animate-pulse">
          <p className="text-neutral-500 font-oswald text-3xl uppercase italic tracking-tighter">Nenhum perna de pau encontrado com "{search}"</p>
          <p className="text-[11px] font-mono text-neutral-600 uppercase mt-4 tracking-[0.5em]">Tente procurar alguém que realmente joga (ou não).</p>
        </div>
      )}
    </div>
  );
};

export const ShameCard = ({ title, player, description, date }: { title: string, player: Player, description: string, date: string }) => (
  <div className="bg-neutral-900 border border-neutral-800 hover:border-red-900 transition-all p-5 flex flex-col space-y-4 shadow-lg group">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-mono text-red-600 font-bold uppercase tracking-widest bg-red-900/10 px-2 py-1">{title}</span>
      <span className="text-[10px] font-mono text-neutral-600 uppercase">{date}</span>
    </div>
    <div className="flex items-start gap-4">
      <img src={player?.photo} className="w-12 h-12 grayscale border border-neutral-800" />
      <div>
        <h4 className="text-white font-oswald text-lg uppercase leading-none mb-1">{player?.nickname}</h4>
        <p className="text-neutral-400 text-xs leading-relaxed italic">"{description}"</p>
      </div>
    </div>
    <div className="pt-2 border-t border-neutral-800 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="text-[10px] text-neutral-600 font-mono uppercase">Visto por 12 viciados</span>
      <button className="text-[10px] text-red-500 font-bold uppercase hover:underline">Zuar no Chat</button>
    </div>
  </div>
);

export default Rankings;
