
import React from 'react';
import { Player, GlobalFinances } from '../types';

interface CaixinhaProps {
  players: Player[];
  finances: GlobalFinances;
  currentUser: Player;
}

const Caixinha: React.FC<CaixinhaProps> = ({ players, finances, currentUser }) => {
  const caloteiros = players.filter(p => !p.isPaid && (p.debt || 0) > 0);
  const pendingTotal = caloteiros.reduce((acc, p) => acc + (p.debt || 25), 0);

  // Lógica de Admin: Tonoli ou quem tiver badge de Fundador (f1)
  const isAdmin = currentUser.nickname === 'Tonoli' || currentUser.badges?.includes('f1');

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 animate-in fade-in duration-700 pb-20">
      {/* 💰 ESTADO GERAL DO CAIXA (SÓ ADM VÊ) */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 p-8 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-[0.5em] mb-2">Saldo em Cofre (Privado)</p>
                <h3 className="text-5xl font-oswald font-black text-green-500 tracking-tighter">R$ {finances?.total_balance || 0}</h3>
                <p className="text-[9px] text-neutral-600 font-mono uppercase mt-4">Dinheiro vivo ou em conta do admin</p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <span className="text-7xl">🏦</span>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-8 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-[0.5em] mb-2">Dívida Ativa (Pendentes)</p>
                <h3 className="text-5xl font-oswald font-black text-red-600 tracking-tighter">R$ {pendingTotal}</h3>
                <p className="text-[9px] text-neutral-600 font-mono uppercase mt-4">Valor total que falta cair no caixa</p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <span className="text-7xl">💸</span>
              </div>
            </div>
          </div>

          {/* 🎯 OBJETIVOS DA PELADA */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 space-y-6">
            <h4 className="text-sm font-oswald font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span> Objetivos Estratégicos
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finances?.goals?.length > 0 ? finances.goals.map(goal => (
                <div key={goal.id} className="bg-black border border-neutral-800 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-oswald text-white uppercase">{goal.title}</span>
                    <span className="text-[10px] font-mono text-neutral-500">{Math.round((goal.current / goal.target) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-600 shadow-[0_0_10px_rgba(202,138,4,0.4)]" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono uppercase">
                    <span className="text-neutral-600">Faltam R$ {goal.target - goal.current}</span>
                    <span className="text-white">Meta R$ {goal.target}</span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-neutral-600 font-mono text-[9px] uppercase col-span-full py-4">Nenhum objetivo definido ainda.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* 🤡 MURAL DA VERGONHA (PÚBLICO) */}
      <div className="bg-red-950/20 border-2 border-red-900 p-8 rounded-none relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 -mr-10 -mt-10">
          <span className="text-[12rem] font-black italic">SHAME</span>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-4 bg-red-700 text-white px-4 py-1 font-oswald text-xs uppercase italic tracking-[0.3em] animate-pulse">
            Aviso de Cobrança Mandatória
          </div>
          <h2 className="text-6xl font-oswald font-black uppercase text-white tracking-tighter mb-2 italic">Lista de Caloteiros</h2>
          <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.5em] max-w-md">
            Se seu nome está abaixo, você perdeu o direito de reclamar de passe errado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1">
        {caloteiros.length > 0 ? (
          caloteiros.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 hover:border-red-900 transition-all group">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <img src={p.photo} alt={p.nickname} className="w-12 h-12 grayscale contrast-150 border border-neutral-800 object-cover" />
                  <div className="absolute inset-0 bg-red-900/20 opacity-40"></div>
                </div>
                <div>
                  <span className="text-white font-oswald text-xl font-bold uppercase block leading-none">{p.nickname}</span>
                  <span className="text-neutral-500 font-mono text-[9px] uppercase">Dívida Ativa • Vencimento Imediato</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-red-600 font-oswald text-3xl font-black block tracking-tighter">R$ {p.debt || 25},00</span>
                <span className="text-neutral-600 font-mono text-[8px] uppercase">Pague ou apanhe</span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-20 text-center border border-neutral-800 bg-neutral-900/50">
            <p className="text-green-600 font-oswald text-3xl uppercase italic font-black">Ninguém deve nada... por enquanto.</p>
            <p className="text-neutral-500 font-mono text-[10px] uppercase mt-2 tracking-widest italic">A paz reina no caixa da várzea.</p>
          </div>
        )}
      </div>

      {caloteiros.length > 0 && (
        <button className="w-full py-5 bg-red-800 hover:bg-black text-white font-oswald uppercase text-xl font-black transition-all italic tracking-tighter border-2 border-red-700 group flex items-center justify-center gap-4">
          <span className="group-hover:translate-x-2 transition-transform">EXPOR CALOTEIROS NO WHATSAPP</span>
          <span className="text-2xl">📢</span>
        </button>
      )}
    </div>
  );
};

export default Caixinha;
