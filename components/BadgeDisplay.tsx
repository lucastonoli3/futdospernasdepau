
import React from 'react';
import { Badge } from '../types';
import { ALL_BADGES } from '../constants';

interface BadgeDisplayProps {
  badgeId: string;
  showTitle?: boolean;
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badgeId, showTitle = false }) => {
  const badge = ALL_BADGES.find(b => b.id === badgeId);

  if (!badge) return null;

  const isElite = badge.category === 'Elite';
  const isArchitect = badge.category === 'Architect';
  const isBagre = badge.category === 'Bagre';

  return (
    <div className="group relative flex flex-col items-center">
      <div className={`w-10 h-10 flex items-center justify-center rounded-full text-2xl transition-all duration-700 group-hover:scale-125 
        ${isArchitect
          ? 'bg-gradient-to-tr from-purple-800 via-violet-600 to-indigo-950 border-2 animate-magic-glow animate-nebula relative overflow-hidden'
          : isBagre
            ? 'bg-gradient-to-br from-stone-800 via-stone-900 to-green-950 border-2 border-stone-700 shadow-[0_0_15px_rgba(40,40,30,0.5)] group-hover:shadow-[0_0_20px_rgba(20,40,20,0.8)]'
            : isElite
              ? 'bg-gradient-to-br from-yellow-400 via-yellow-600 to-yellow-900 border-2 border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] group-hover:shadow-[0_0_25px_rgba(234,179,8,0.8)]'
              : 'bg-neutral-800 border border-neutral-700'}`}>

        {isArchitect && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.4),transparent_70%)] animate-pulse"></div>
        )}

        <span className={isArchitect ? 'animate-magic-float drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] z-10' : ''}>
          {badge.icon.startsWith('http') || badge.icon.startsWith('/') || badge.icon.startsWith('data:') ? (
            <img
              src={badge.icon}
              alt={badge.name}
              className="w-8 h-8 rounded-full object-cover shadow-inner"
            />
          ) : (
            badge.icon
          )}
        </span>
      </div>
      {showTitle && (
        <span className={`text-[10px] mt-1 font-black text-center uppercase tracking-tighter 
          ${isArchitect ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,1)]' : isBagre ? 'text-stone-500' : isElite ? 'text-yellow-500 animate-pulse' : 'text-neutral-500'}`}>
          {badge.name}
        </span>
      )}

      <div className={`absolute bottom-full mb-2 hidden group-hover:block z-20 w-48 border p-3 rounded-none shadow-2xl text-[10px] font-mono leading-tight
        ${isArchitect ? 'bg-black/90 border-purple-500 backdrop-blur-md shadow-purple-900/50' : isBagre ? 'bg-stone-950 border-stone-800' : isElite ? 'bg-black border-yellow-600' : 'bg-neutral-900 border-neutral-700'}`}>
        <p className={`font-black uppercase mb-1 ${isArchitect ? 'text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]' : isBagre ? 'text-stone-400' : isElite ? 'text-yellow-500' : 'text-white'}`}>{badge.name}</p>
        <p className="text-neutral-400 italic">"{badge.description}"</p>
      </div>
    </div>
  );
};

export default BadgeDisplay;
