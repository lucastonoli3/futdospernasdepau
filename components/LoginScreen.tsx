import React, { useState, useRef } from 'react';
import { Player, Position, PlayerStatus } from '../types';
import { aiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { ADMIN_NICKNAMES } from '../constants';
import Logo from './Logo';

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
    memberSinceYear: '',
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      setCameraError('Precisamos liberar a câmera pra tirar sua foto de sócio.');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        setFormData({ ...formData, photo: base64data });
        stopCamera();
        setIsAnalyzing(false);
      };
    } catch (err) {
      setError('Erro ao processar imagem. Tenta outro arquivo.');
      setIsAnalyzing(false);
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

        setFormData({ ...formData, photo: photoDataUrl });
        stopCamera();

        setIsAnalyzing(false);
      }
    }
  };

  const handleLoginAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      setError('Preencha o apelido e a senha pra entrar.');
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
            is_admin: player.is_admin || ADMIN_NICKNAMES.includes(player.nickname?.toLowerCase() || ''),
            password: player.password
          };
          onLogin(formatted);
        } else {
          setError('Senha incorreta. Confere e tenta de novo.');
        }
      } else {
        setError('Apelido não encontrado. É novo no Balaio? Clica em "Sou novo aqui".');
      }
    } catch (err) {
      setError('Erro de conexão. Tenta de novo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const isReserved = nickname.trim().toLowerCase() === 'adminvantablack';

    if (isReserved) {
      setError('Esse apelido é reservado. Escolha outro.');
      return;
    }

    if (!nickname.trim() || !formData.name || !formData.newPassword) {
      setError('Preencha apelido, nome e senha.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // O clube está vazio? Então este é o FUNDADOR (entra como diretoria, sem padrinho).
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true });
      const isFounder = (count || 0) === 0;
      const isTonoli = nickname.trim().toLowerCase() === 'tonoli';
      const skipVoucher = isFounder || isTonoli;

      // Validar Padrinho (só se não for fundador)
      if (!skipVoucher) {
        if (!formData.invitedBy.trim()) {
          setError('Informe o apelido de quem te indicou.');
          setIsAnalyzing(false);
          return;
        }
        const { data: voucher } = await supabase
          .from('players')
          .select('nickname')
          .ilike('nickname', formData.invitedBy.trim())
          .maybeSingle();

        if (!voucher) {
          setError(`O sócio "${formData.invitedBy}" não foi encontrado no Balaio.`);
          setIsAnalyzing(false);
          return;
        }
      }

      const newPlayerData = {
        name: formData.name,
        nickname: nickname.trim(),
        password: formData.newPassword,
        photo: formData.photo || 'https://api.dicebear.com/7.x/thumbs/png?seed=' + encodeURIComponent(nickname.trim()),
        position: formData.position,
        invited_by: formData.invitedBy.trim() || (isFounder ? 'Fundador' : 'Diretoria'),
        matches_played: 0,
        goals: 0,
        assists: 0,
        best_votes: 0,
        worst_votes: 0,
        moral_score: 100,
        status: PlayerStatus.NORMAL,
        is_admin: isFounder || isTonoli,
        is_paid: false,
        member_since: formData.memberSinceYear ? `${formData.memberSinceYear}-01-01` : null,
        badges: JSON.stringify(isFounder ? ['b1', 'leg1', 'leg2'] : (isTonoli ? ['b1', 'leg1'] : ['b1']))
      };

      let { data, error: iError } = await supabase
        .from('players')
        .insert([newPlayerData])
        .select()
        .single();

      // Fallback: se o banco ainda não tem alguma coluna nova (ex.: member_since),
      // remove os campos opcionais e tenta de novo — cadastro não pode travar.
      if (iError && /column|schema/i.test(iError.message || '')) {
        const { member_since, is_admin, is_paid, ...legacyData } = newPlayerData as any;
        const retry = await supabase.from('players').insert([legacyData]).select().single();
        data = retry.data;
        iError = retry.error;
      }

      if (iError) {
        console.error('Erro no cadastro:', iError);
        setError('Erro ao criar sua ficha: ' + (iError.message || 'tente outro apelido.'));
      } else {
        onLogin({
          ...data,
          badges: typeof data.badges === 'string' ? JSON.parse(data.badges) : (data.badges || []),
          matchesPlayed: data.matches_played,
          bestVotes: data.best_votes,
          worstVotes: data.worst_votes,
          moralScore: data.moral_score,
          is_admin: data.is_admin || ADMIN_NICKNAMES.includes(data.nickname?.toLowerCase() || ''),
          password: data.password
        });
      }
    } catch (err) {
      setError('Sistema indisponível. Tenta de novo daqui a pouco.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4 animate-in fade-in duration-1000">
      <div className="bg-neutral-900 w-full max-w-sm p-6 rounded-2xl border-2 border-gold/30 shadow-2xl relative">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2"><Logo size={64} /></div>
          <h2 className="text-3xl font-oswald text-gold uppercase tracking-tighter italic">
            {isRegistering ? 'Novo Sócio' : 'Área do Sócio'}
          </h2>
          <p className="text-[10px] text-neutral-500 font-mono uppercase font-bold">Balaio de Gato FC</p>
        </div>

        {!isRegistering ? (
          /* MODO LOGIN */
          <form onSubmit={handleLoginAttempt} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase mb-1">Vulgo (Apelido)</label>
              <input
                type="text"
                required
                className="w-full bg-black border border-neutral-800 p-3 text-white focus:outline-none focus:border-gold font-mono text-sm"
                placeholder="Seu apelido no Balaio"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase mb-1">Senha de Acesso</label>
              <input
                type="password"
                required
                className="w-full bg-black border border-neutral-800 p-3 text-white focus:outline-none focus:border-gold font-mono text-sm"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-yellow-600 text-[10px] font-black uppercase bg-yellow-900/10 p-2 border border-yellow-900/20">{error}</p>}
            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full bg-gold hover:bg-gold-600 text-black font-black font-oswald text-xl py-3 border border-gold-700 transition-all uppercase italic shadow-[0_0_20px_rgba(245,197,24,0.25)]"
            >
              {isAnalyzing ? 'Processando...' : 'Entrar no Vestiário'}
            </button>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="text-neutral-500 text-[9px] uppercase font-black hover:text-white transition-all underline decoration-gold/40"
              >
                Sou novo aqui (Criar conta de sócio)
              </button>
            </div>
          </form>
        ) : (
          /* MODO CADASTRO */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-black text-neutral-500 uppercase">Seu Vulgo (Como será chamado)</label>
                <input
                  type="text"
                  required
                  className="w-full bg-black border border-neutral-800 p-2 text-gold font-mono text-xs focus:outline-none focus:border-gold"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="Ex: Gato Mestre"
                />
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
                <label className="block text-[10px] font-black text-gold uppercase mb-1">Sua Senha</label>
                <input
                  type="password"
                  required
                  className="w-full bg-black border border-gold/30 p-2 text-white font-mono text-xs"
                  placeholder="Crie sua senha"
                  value={formData.newPassword}
                  onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gold uppercase mb-1">Quem te indicou (apelido) <span className="text-neutral-500 normal-case">— deixe vazio se for o 1º sócio</span></label>
              <input
                type="text"
                className="w-full bg-black border border-gold/30 p-2 text-white font-mono text-xs"
                value={formData.invitedBy}
                onChange={e => setFormData({ ...formData, invitedBy: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gold uppercase mb-1">Está no Balaio desde… <span className="text-neutral-500 normal-case">(que ano você entrou?)</span></label>
              <select
                className="w-full bg-black border border-gold/30 p-2 text-white text-xs"
                value={formData.memberSinceYear}
                onChange={e => setFormData({ ...formData, memberSinceYear: e.target.value })}
              >
                <option value="">Prefiro não dizer</option>
                {Array.from({ length: (new Date().getFullYear() - 2000) + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-[9px] text-neutral-500 mt-1">Quanto mais antigo, mais orgulho. Isso aparece no seu perfil.</p>
            </div>

            {/* CAMERA MOBILE FRIENDLY */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-neutral-400 uppercase">Foto de Perfil (Opcional, mas recomendado)</label>
              <div className="relative w-full aspect-video bg-black border border-neutral-800 flex items-center justify-center overflow-hidden">
                {formData.photo ? (
                  <img src={formData.photo} className="w-full h-full object-cover" alt="Foto" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${!isCameraOpen ? 'hidden' : ''}`} />
                )}
                {!formData.photo && !isCameraOpen && <span className="text-neutral-700 text-2xl">📸</span>}
                {isAnalyzing && <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-gold text-[10px] font-mono animate-pulse">PROCESSANDO...</div>}
              </div>

              {!formData.photo && !isCameraOpen && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={startCamera} className="bg-neutral-800 text-white text-[10px] py-2 border border-neutral-700 uppercase font-black hover:bg-neutral-700 transition-all">Ligar Câmera</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-neutral-800 text-white text-[10px] py-2 border border-neutral-700 uppercase font-black hover:bg-neutral-700 transition-all">Subir Foto</button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                </div>
              )}
              {!formData.photo && isCameraOpen && (
                <button type="button" onClick={takePhoto} className="w-full bg-gold text-black text-[10px] py-1 border border-gold-700 uppercase font-black">Tirar Foto</button>
              )}
              {formData.photo && (
                <button type="button" onClick={() => { setFormData({ ...formData, photo: '' }); startCamera(); }} className="w-full bg-yellow-600 text-black text-[10px] py-1 uppercase font-black">Tirar Outra</button>
              )}
            </div>

            {error && <p className="text-yellow-600 text-[10px] font-black uppercase bg-yellow-900/10 p-2 border border-yellow-900/20">{error}</p>}

            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full bg-gold hover:bg-gold-600 text-black font-black font-oswald text-xl py-3 border border-gold-700 transition-all uppercase italic"
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
