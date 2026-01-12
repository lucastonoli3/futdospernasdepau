import React, { useState, useRef } from 'react';
import { Player, Position, PlayerStatus } from '../types';
import { geminiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';

interface LoginScreenProps {
  onLogin: (player: Player) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    position: Position.LINHA,
    photo: '',
    invitedBy: '',
    newPassword: '',
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      setCameraError('Libera a câmera, covarde! Sem foto, sem jogo.');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraOpen(false);
    }
  };

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Compressão via Resize de Canvas (FinOps)
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / videoRef.current.videoWidth);
        canvasRef.current.width = videoRef.current.videoWidth * scale;
        canvasRef.current.height = videoRef.current.videoHeight * scale;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const photoDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);

        setIsAnalyzing(true);
        setError('');
        videoRef.current.pause();

        const hasFace = await geminiService.validateFaceInImage(photoDataUrl);

        if (hasFace) {
          setFormData({ ...formData, photo: photoDataUrl });
          stopCamera();
        } else {
          setError('Cadê tua cara, assombração? A IA não achou rosto nenhum.');
          videoRef.current.play();
        }
        setIsAnalyzing(false);
      }
    }
  };

  const handleLoginAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      setError('Preenche o vulgo e a senha, bagre.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const { data: player, error: fError } = await supabase
        .from('players')
        .select('*')
        .ilike('nickname', nickname.trim())
        .maybeSingle();

      if (player) {
        // Validação Simples de Senha (em texto puro para este MVP, idealmente usar hashing se for para produção séria)
        if (player.password === password.trim()) {
          const formatted: Player = {
            ...player,
            badges: typeof player.badges === 'string' ? JSON.parse(player.badges) : player.badges,
            matchesPlayed: player.matches_played,
            bestVotes: player.best_votes,
            worstVotes: player.worst_votes,
            moralScore: player.moral_score,
            password: player.password
          };
          onLogin(formatted);
        } else {
          setError('SENHA INCORRETA. Tentando invadir a conta dos outros, malandro?');
        }
      } else {
        setError('VULGO NÃO ENCONTRADO. Tu é novo aqui? Se sim, clica em "Novo Atleta".');
      }
    } catch (err) {
      setError('Erro ao consultar o bueiro. Tenta de novo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const isTonoli = nickname.trim().toLowerCase() === 'tonoli';
    const isAdmin = nickname.trim().toLowerCase() === 'adminvantablack';

    if (isAdmin && isRegistering) {
      setError('ESSE VULGO É SAGRADO. Escolha outro, mortal.');
      return;
    }

    if (!isTonoli && (!formData.name || !formData.photo || !formData.invitedBy || !formData.newPassword)) {
      setError('Preenche tudo, pereba. Nome, Foto, Padrinho e Senha são obrigatórios.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // Validar Padrinho
      const { data: voucher } = await supabase
        .from('players')
        .select('nickname')
        .eq('nickname', formData.invitedBy.trim())
        .single();

      if (!voucher && !isTonoli) {
        setError(`ERRO: Esse tal de "${formData.invitedBy}" não existe na nossa pelada.`);
        setIsAnalyzing(false);
        return;
      }

      const newPlayerData = {
        name: formData.name || 'Mestre Tonoli',
        nickname: nickname.trim(),
        password: formData.newPassword || '1234',
        photo: formData.photo || 'https://images.unsplash.com/photo-1552318975-2758c75116bd?auto=format&fit=crop&q=80&w=1000',
        position: formData.position,
        invited_by: formData.invitedBy.trim() || 'AdminVantablack',
        matches_played: 0,
        goals: 0,
        assists: 0,
        best_votes: 0,
        worst_votes: 0,
        moral_score: isTonoli ? 100 : 50,
        status: PlayerStatus.NORMAL,
        badges: JSON.stringify(isTonoli ? ['b1', 'f1'] : ['b1'])
      };

      const { data, error: iError } = await supabase
        .from('players')
        .insert([newPlayerData])
        .select()
        .single();

      if (iError) {
        setError('ERRO AO CRIAR FICHA. Tenta outro vulgo.');
      } else {
        onLogin({
          ...data,
          badges: JSON.parse(data.badges),
          matchesPlayed: data.matches_played,
          bestVotes: data.best_votes,
          worstVotes: data.worst_votes,
          moralScore: data.moral_score,
          password: data.password
        });
      }
    } catch (err) {
      setError('Sistema fora de jogo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4 animate-in fade-in duration-1000">
      <div className="bg-neutral-900 w-full max-w-sm p-6 rounded-sm border-2 border-red-900 shadow-2xl relative">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-oswald text-red-600 uppercase tracking-tighter italic">
            {isRegistering ? 'Nova Ficha' : 'Identifique-se'}
          </h2>
          <p className="text-[10px] text-neutral-500 font-mono uppercase font-bold">Acesso Restrito aos Viciados</p>
        </div>

        {!isRegistering ? (
          /* MODO LOGIN */
          <form onSubmit={handleLoginAttempt} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase mb-1">Vulgo (Apelido)</label>
              <input
                type="text"
                required
                className="w-full bg-black border border-neutral-800 p-3 text-white focus:outline-none focus:border-red-600 font-mono text-sm"
                placeholder="Ex: Mão de Tesoura"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase mb-1">Senha de Acesso</label>
              <input
                type="password"
                required
                className="w-full bg-black border border-neutral-800 p-3 text-white focus:outline-none focus:border-red-600 font-mono text-sm"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-yellow-600 text-[10px] font-black uppercase bg-yellow-900/10 p-2 border border-yellow-900/20">{error}</p>}
            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full bg-red-800 hover:bg-black text-white font-black font-oswald text-xl py-3 border border-red-700 transition-all uppercase italic shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isAnalyzing ? 'Processando...' : 'Invadir o Campo'}
            </button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="text-neutral-500 text-[9px] uppercase font-black hover:text-white transition-all underline decoration-red-900"
              >
                Sou novo aqui (Criar Ficha com Senha)
              </button>
            </div>
          </form>
        ) : (
          /* MODO CADASTRO */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-black text-neutral-500 uppercase">Vulgo Selecionado</label>
                <div className="p-2 bg-black border border-neutral-800 text-red-600 font-mono text-xs">{nickname || 'Nenhum'}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                className="text-[8px] text-neutral-500 uppercase underline text-right"
              >
                ← Voltar para Login
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase mb-1">Nome Real</label>
                <input
                  type="text"
                  required
                  className="w-full bg-black border border-neutral-800 p-2 text-white font-mono text-xs"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-red-600 uppercase mb-1">Sua Senha</label>
                <input
                  type="password"
                  required
                  className="w-full bg-black border border-red-900/30 p-2 text-white font-mono text-xs"
                  placeholder="Crie sua senha"
                  value={formData.newPassword}
                  onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-red-600 uppercase mb-1">Vulgo do Padrinho (Indicação)</label>
              <input
                type="text"
                required
                className="w-full bg-black border border-red-900/30 p-2 text-white font-mono text-xs"
                value={formData.invitedBy}
                onChange={e => setFormData({ ...formData, invitedBy: e.target.value })}
              />
            </div>

            {/* CAMERA MOBILE FRIENDLY */}
            <div className="space-y-2">
              <div className="relative w-full aspect-video bg-black border border-neutral-800 flex items-center justify-center overflow-hidden">
                {formData.photo ? (
                  <img src={formData.photo} className="w-full h-full object-cover" alt="Foto" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${!isCameraOpen ? 'hidden' : ''}`} />
                )}
                {!formData.photo && !isCameraOpen && <span className="text-neutral-700 text-2xl">📸</span>}
                {isAnalyzing && <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-red-600 text-[10px] font-mono animate-pulse">ANALISANDO ROSTO...</div>}
              </div>

              {!formData.photo && !isCameraOpen && (
                <button type="button" onClick={startCamera} className="w-full bg-neutral-800 text-white text-[10px] py-1 border border-neutral-700 uppercase font-black">Ligar Câmera</button>
              )}
              {!formData.photo && isCameraOpen && (
                <button type="button" onClick={takePhoto} className="w-full bg-red-600 text-white text-[10px] py-1 border border-red-500 uppercase font-black">Bater Retrato</button>
              )}
              {formData.photo && (
                <button type="button" onClick={() => { setFormData({ ...formData, photo: '' }); startCamera(); }} className="w-full bg-yellow-600 text-black text-[10px] py-1 uppercase font-black">Tirar Outra</button>
              )}
            </div>

            {error && <p className="text-yellow-600 text-[10px] font-black uppercase bg-yellow-900/10 p-2 border border-yellow-900/20">{error}</p>}

            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full bg-red-800 hover:bg-black text-white font-black font-oswald text-xl py-3 border border-red-700 transition-all uppercase italic"
            >
              Confirmar Inscrição
            </button>
          </form>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default LoginScreen;
