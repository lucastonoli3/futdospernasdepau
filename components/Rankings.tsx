
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
    className="flex items-center justify-between p-3 bg-neutral-900 hover:bg-black border border-neutral-800 hover:border-red-900 cursor-pointer transition-all mb-2 group"
  >
    <div className="flex items-center space-x-3">
      <span className="text-[10px] font-bold text-neutral-600 w-4 font-mono">#{index + 1}</span>
      <img src={player.photo} className="w-8 h-8 rounded-none grayscale group-hover:grayscale-0 border border-neutral-800 transition-all" alt={player.nickname} />
      <span className="font-oswald text-sm text-neutral-300 group-hover:text-white uppercase tracking-tight">{player.nickname}</span>
    </div>
    <div className="flex items-center space-x-1">
      <span className="font-oswald font-bold text-lg text-white">{value}</span>
      <span className="text-sm">{icon}</span>
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
  const bolaDeOuro = [...players].sort((a, b) => b.bestVotes - a.bestVotes)[0];
  const bagreDaSemana = [...players].sort((a, b) => b.worstVotes - a.worstVotes)[0];

  return (
    <div className="space-y-12 w-full max-w-6xl mx-auto px-4">
      {/* BARRA DE BUSCA (NOVO) */}
      <div className="relative max-w-xl mx-auto mb-12 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-xl group-focus-within:text-red-600 transition-colors">🔍</span>
        </div>
        <input
          type="text"
          placeholder="PROCURAR ELEMENTO (CHAPA, NOME, VAGABUNDO)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black border-2 border-neutral-900 p-4 pl-12 text-white font-oswald uppercase tracking-widest focus:border-red-900 outline-none transition-all placeholder:text-neutral-700"
        />
        <div className="absolute bottom-0 left-0 h-[1px] bg-red-600 w-0 group-focus-within:w-full transition-all duration-500"></div>
      </div>

      {search === '' && bolaDeOuro && bagreDaSemana && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SEÇÃO BOLA DE OURO (MVP) */}
          <section className="relative overflow-hidden group cursor-pointer border border-yellow-600/20 bg-black/40" onClick={() => onPlayerClick(bolaDeOuro)}>
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/10 via-black to-yellow-900/10 z-0"></div>
            <div className="relative z-10 p-6 flex flex-col items-center text-center group-hover:bg-yellow-900/5 transition-all duration-700">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-yellow-500 rounded-full blur-2xl opacity-10 group-hover:opacity-20 animate-pulse"></div>
                <img src={bolaDeOuro.photo} className="w-24 h-24 object-cover border-4 border-yellow-600 relative z-10 grayscale-0 shadow-[0_0_30px_rgba(234,179,8,0.2)]" />
                <div className="absolute -top-2 -left-2 bg-yellow-600 text-black font-black font-oswald text-xl px-2 z-20 shadow-[0_0_15px_rgba(234,179,8,0.4)]">MVP</div>
              </div>
              <p className="text-yellow-600 font-mono text-[8px] uppercase tracking-[0.5em] mb-1 font-black">Elite da Várzea</p>
              <h2 className="text-3xl font-oswald font-black text-white uppercase italic tracking-tighter leading-none group-hover:text-yellow-500 transition-colors">{bolaDeOuro.nickname}</h2>
              <p className="text-neutral-500 font-oswald text-sm uppercase mt-1">Bola de Ouro da Semana</p>
              <div className="mt-4 flex gap-4">
                <span className="text-white font-oswald text-xs uppercase"><span className="text-yellow-500 font-black">{bolaDeOuro.bestVotes}</span> Votos</span>
                <span className="text-white font-oswald text-xs uppercase"><span className="text-yellow-500 font-black">{bolaDeOuro.goals}</span> Gols</span>
              </div>
            </div>
          </section>

          {/* SEÇÃO BAGRE DA SEMANA (SHAME) */}
          <section className="relative overflow-hidden group cursor-pointer border border-red-900/20 bg-black/40" onClick={() => onPlayerClick(bagreDaSemana)}>
            <div className="absolute inset-0 bg-gradient-to-r from-red-950/10 via-black to-red-950/10 z-0"></div>
            <div className="relative z-10 p-6 flex flex-col items-center text-center group-hover:bg-red-950/5 transition-all duration-700">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-red-500 rounded-full blur-2xl opacity-10 group-hover:opacity-20 animate-pulse"></div>
                <img src={bagreDaSemana.photo} className="w-24 h-24 object-cover border-4 border-red-900 relative z-10 grayscale contrast-125 shadow-[0_0_30px_rgba(220,38,38,0.2)]" />
                <div className="absolute -top-2 -left-2 bg-red-900 text-white font-black font-oswald text-xl px-2 z-20 shadow-[0_0_15px_rgba(220,38,38,0.4)]">BAGRE</div>
              </div>
              <p className="text-red-600 font-mono text-[8px] uppercase tracking-[0.5em] mb-1 font-black">Inimigo da Bola</p>
              <h2 className="text-3xl font-oswald font-black text-white uppercase italic tracking-tighter leading-none group-hover:text-red-500 transition-colors">{bagreDaSemana.nickname}</h2>
              <p className="text-neutral-500 font-oswald text-sm uppercase mt-1">O Pior da Semana</p>
              <div className="mt-4 flex gap-4">
                <span className="text-white font-oswald text-xs uppercase"><span className="text-red-600 font-black">{bagreDaSemana.worstVotes}</span> Crimes</span>
                <span className="text-white font-oswald text-xs uppercase"><span className="text-red-600 font-black">{bagreDaSemana.matchesPlayed}</span> Jogos</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Artilharia */}
          {topScorers.length > 0 && (
            <div className="bg-neutral-900/40 p-5 border border-neutral-800 shadow-lg">
              <h3 className="text-xl font-oswald text-yellow-500 uppercase mb-4 flex items-center gap-2">
                <span>⚽</span> Artilharia
              </h3>
              {topScorers.map((p, idx) => (
                <RankingItem key={p.id} player={p} value={p.goals} index={idx} icon="" onClick={onPlayerClick} />
              ))}
            </div>
          )}

          {/* Garçons */}
          {topAssists.length > 0 && (
            <div className="bg-neutral-900/40 p-5 border border-neutral-800 shadow-lg">
              <h3 className="text-xl font-oswald text-blue-500 uppercase mb-4 flex items-center gap-2">
                <span>🎯</span> Garçons
              </h3>
              {topAssists.map((p, idx) => (
                <RankingItem key={p.id} player={p} value={p.assists} index={idx} icon="" onClick={onPlayerClick} />
              ))}
            </div>
          )}

          {/* Inimigos da Bola */}
          {worstOfPelada.length > 0 && (
            <div className="bg-neutral-900/40 p-5 border border-neutral-800 shadow-lg">
              <h3 className="text-xl font-oswald text-red-500 uppercase mb-4 flex items-center gap-2">
                <span>🤢</span> Inimigos da Bola
              </h3>
              {worstOfPelada.map((p, idx) => (
                <RankingItem key={p.id} player={p} value={p.worstVotes} index={idx} icon="" onClick={onPlayerClick} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-20 text-center border-2 border-dashed border-neutral-900">
          <p className="text-neutral-500 font-oswald text-2xl uppercase italic">Nenhum perna de pau encontrado com "{search}"</p>
          <p className="text-[10px] font-mono text-neutral-700 uppercase mt-2">Tente procurar por alguém que realmente existe ou saia da frente da tela.</p>
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
