
import React, { useState, useEffect, useRef } from 'react';
import { Player, HeritageItem } from '../types';
import BadgeDisplay from './BadgeDisplay';
import { geminiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';

interface PlayerProfileProps {
  player: Player;
  currentUser: Player | null;
}

const PlayerProfile: React.FC<PlayerProfileProps> = ({ player, currentUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [heritageItems, setHeritageItems] = useState<HeritageItem[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [thought, setThought] = useState(player.thought || "");
  const [highBadges, setHighBadges] = useState<string[]>(player.high_badges || []);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);

  // Estados para novas conquistas
  const [newHeritage, setNewHeritage] = useState({ title: '', photo: '', type: 'album' as 'album' | 'trophy' });
  const [tempFile, setTempFile] = useState<File | null>(null);
  const [tempPreview, setTempPreview] = useState<string | null>(null);
  // Estados para troca de foto de perfil
  const [tempFileAvatar, setTempFileAvatar] = useState<File | null>(null);
  const [tempPreviewAvatar, setTempPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isOwner = currentUser?.id === player.id;

  useEffect(() => {
    fetchExtras();
  }, [player.id]);

  const fetchExtras = async () => {
    const { data: hData } = await supabase.from('heritage').select('*').eq('player_id', player.id).order('date', { ascending: false });
    if (hData) setHeritageItems(hData);
  };

  useEffect(() => {
    if (isExpanded && !aiAnalysis) {
      loadAiDossier();
    }
  }, [isExpanded]);

  const loadAiDossier = async (forceRefresh = false) => {
    // FinOps: Usar cache se existir e não for refresh forçado
    if (player.ai_dossier && !forceRefresh) {
      setAiAnalysis(player.ai_dossier);
      return;
    }

    setLoadingAi(true);
    try {
      const stats = `Gols: ${player.goals}, Assistêncas: ${player.assists}, Moral: ${player.moralScore}`;
      const dossier = await geminiService.generatePlayerDossier(player.nickname, stats, player.moralScore, "");

      // Salvar no banco para cache
      await supabase
        .from('players')
        .update({
          ai_dossier: dossier,
          last_ai_update: new Date().toISOString()
        })
        .eq('id', player.id);

      setAiAnalysis(dossier || "IA sem palavras para esse fenômeno.");
    } catch (e) {
      setAiAnalysis("Escritório da IA fechado.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTempFile(file);
      setTempPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      let finalPhoto = player.photo;

      // Se houver nova foto de avatar
      if (tempFileAvatar) {
        const fileExt = tempFileAvatar.name.split('.').pop();
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${player.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('player_assets')
          .upload(filePath, tempFileAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('player_assets')
          .getPublicUrl(filePath);

        finalPhoto = publicUrl;
      }

      const { error } = await supabase
        .from('players')
        .update({
          thought: thought,
          high_badges: highBadges,
          photo: finalPhoto
        })
        .eq('id', player.id);

      if (error) {
        console.error("Erro ao salvar pensamento/badges:", error);
        alert("ERRO NO SUPABASE: " + error.message);
      } else {
        setIsEditing(false);
        // Recarregar a página para atualizar o header/ranking etc se necessário
        if (finalPhoto !== player.photo) window.location.reload();
      }
    } catch (err) {
      alert("Erro ao salvar perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHeritage = async () => {
    if (!newHeritage.title || !tempFile) {
      alert("Dá um título e escolhe a foto, bagre!");
      return;
    }

    setIsSaving(true);
    setUploadProgress(true);

    try {
      // 1. Upload para o Storage com Compressão
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true
      };

      const compressedFile = await imageCompression(tempFile, options);
      const fileExt = tempFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `heritage/${player.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('player_assets')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      // 2. Pegar URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('player_assets')
        .getPublicUrl(filePath);

      // 3. Salvar no Banco
      const { error: dbError } = await supabase.from('heritage').insert([{
        player_id: player.id,
        title: newHeritage.title,
        photo: publicUrl,
        type: newHeritage.type,
        date: new Date().toISOString().split('T')[0]
      }]);

      if (dbError) {
        console.error("Erro ao inserir no banco heritage:", dbError);
        throw dbError;
      }

      setNewHeritage({ title: '', photo: '', type: 'album' });
      setTempFile(null);
      setTempPreview(null);
      fetchExtras();
    } catch (err) {
      console.error(err);
      alert("Erro ao eternizar sua glória no bueiro.");
    } finally {
      setIsSaving(false);
      setUploadProgress(false);
    }
  };

  const toggleHighBadge = (id: string) => {
    if (highBadges.includes(id)) {
      setHighBadges(prev => prev.filter(b => b !== id));
    } else if (highBadges.length < 5) {
      setHighBadges(prev => [...prev, id]);
    }
  };

  const handleDeleteHeritage = async (id: string, photoUrl: string) => {
    if (!window.confirm("Certeza que quer apagar essa memória, fracassado?")) return;

    try {
      // 1. Deletar do Banco
      const { error: dbError } = await supabase
        .from('heritage')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      // 2. Extrair o path para deletar do Storage (opcional)
      // A URL do Supabase Storage é algo como: .../storage/v1/object/public/player_assets/heritage/PLAYER_ID/FILENAME
      // Queremos o path 'heritage/PLAYER_ID/FILENAME'
      try {
        const urlParts = photoUrl.split('/player_assets/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          // Remove query params se houver
          const cleanPath = filePath.split('?')[0];
          await supabase.storage.from('player_assets').remove([decodeURIComponent(cleanPath)]);
        }
      } catch (storageErr) {
        console.warn("Não consegui limpar o storage, mas o registro sumiu:", storageErr);
      }

      setHeritageItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erro ao apagar o rastro da sua vergonha.");
    }
  };

  const handleReportHumiliation = async (type: 'caneta' | 'chapeu' | 'humilhacao') => {
    if (!currentUser) return;
    if (currentUser.id === player.id) {
      alert("Se auto-elogiar é coisa de fracassado.");
      return;
    }

    const { error } = await supabase.from('humiliations').insert([{
      performer_id: currentUser.id,
      victim_id: player.id,
      type: type,
      status: 'pending'
    }]);

    if (!error) {
      alert(`DENÚNCIA DE ${type.toUpperCase()} ENVIADA! Aguarde a confirmação do ADM para ver a moral desse lixo cair.`);
    } else {
      console.error(error);
      alert("Falha ao processar o deboche.");
    }
  };

  const isElite = player.moralScore >= 80;
  const trophies = heritageItems.filter(h => h.type === 'trophy');
  const album = heritageItems.filter(h => h.type === 'album');

  return (
    <div className={`relative overflow-hidden transition-all duration-700 border-b pb-20 ${isElite ? 'border-yellow-600/30 bg-gradient-to-r from-black via-yellow-900/5 to-black' : 'border-neutral-900 bg-black'}`}>

      {/* MODO EDIÇÃO OVERLAY */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-black/95 p-6 overflow-y-auto backdrop-blur-xl animate-in fade-in duration-300 no-scrollbar">
          <div className="max-w-2xl mx-auto space-y-8 pt-10 pb-20">
            <h2 className="text-4xl font-oswald font-black text-red-600 italic uppercase">Dashboard do Viciado</h2>

            {/* Pensamento */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Pensamento de Elite (Frase de Efeito)</label>
              <textarea
                value={thought}
                onChange={e => setThought(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 p-4 font-mono text-sm text-white focus:border-red-600 outline-none h-24"
                placeholder="Ex: No bueiro, quem tem um olho é rei."
              />
            </div>

            {/* Upload de Avatar */}
            <div className={`space-y-4 p-4 border ${isElite ? 'border-yellow-600/30 bg-yellow-900/5' : 'border-neutral-800 bg-neutral-900/40'}`}>
              <label className={`text-[10px] font-black uppercase tracking-widest block ${isElite ? 'text-yellow-500' : 'text-neutral-500'}`}>Trocar Foto de Perfil</label>
              <div className="flex items-center gap-6">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className={`w-24 h-24 border-2 rounded-full overflow-hidden cursor-pointer hover:scale-105 transition-all relative group ${isElite ? 'border-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-neutral-700'}`}
                >
                  <img
                    src={tempPreviewAvatar || player.photo}
                    className="w-full h-full object-cover"
                    alt="Avatar Preview"
                  />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] font-black text-white uppercase text-center px-1">Mudar Imagem</span>
                  </div>
                </div>
                <input
                  type="file"
                  className="hidden"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setTempFileAvatar(file);
                      setTempPreviewAvatar(URL.createObjectURL(file));
                    }
                  }}
                />
                <div className="text-[9px] font-mono text-neutral-500 italic max-w-xs">
                  Sua cara é seu cartão de visitas na biqueira. Capricha na foto ou vai virar meme.
                </div>
              </div>
            </div>

            {/* Destaque de Badges */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Seus Troféus de Honra (Max 5)</label>
                <span className="text-[10px] font-mono text-red-600 font-bold">{highBadges.length}/5</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 p-4 bg-neutral-900/50 border border-neutral-800">
                {player.badges.map(bid => {
                  const isActive = highBadges.includes(bid);
                  return (
                    <div
                      key={bid}
                      onClick={() => toggleHighBadge(bid)}
                      className={`cursor-pointer transition-all flex flex-col items-center ${isActive ? 'opacity-100 scale-105 relative' : 'opacity-20 grayscale'}`}
                    >
                      <BadgeDisplay badgeId={bid} />
                      {isActive && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border border-white"></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Adicionar Heritage NATIVO */}
            <div className="p-6 bg-red-950/10 border border-red-900/30 space-y-5 rounded-sm">
              <label className="text-[10px] font-black text-red-500 uppercase tracking-widest block">Imortalizar Momento (Foto Real)</label>

              <div className="space-y-4">
                <input
                  placeholder="O que aconteceu nesse dia?"
                  className="w-full bg-black border border-neutral-800 p-3 text-sm font-mono text-white focus:border-red-600 outline-none"
                  value={newHeritage.title}
                  onChange={e => setNewHeritage({ ...newHeritage, title: e.target.value })}
                />

                <div className="flex gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 aspect-video bg-black border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center cursor-pointer hover:border-red-600 transition-all overflow-hidden relative"
                  >
                    {tempPreview ? (
                      <img src={tempPreview} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <span className="text-3xl mb-2">📸</span>
                        <span className="text-[9px] font-black text-neutral-600 uppercase">Bater Foto ou Subir Arquivo</span>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>

                  <div className="flex flex-col gap-2 w-1/3">
                    <button
                      onClick={() => setNewHeritage({ ...newHeritage, type: 'album' })}
                      className={`flex-1 text-[9px] font-black px-2 border transition-all ${newHeritage.type === 'album' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border-neutral-800 text-neutral-500 hover:text-white'}`}
                    >MEMÓRIA (ÁLBUM)</button>
                    <button
                      onClick={() => setNewHeritage({ ...newHeritage, type: 'trophy' })}
                      className={`flex-1 text-[9px] font-black px-2 border transition-all ${newHeritage.type === 'trophy' ? 'bg-yellow-600 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-neutral-800 text-neutral-500 hover:text-white'}`}
                    >GLÓRIA (TROFÉU)</button>
                  </div>
                </div>

                <button
                  onClick={handleAddHeritage}
                  disabled={isSaving}
                  className="w-full bg-red-700 text-white text-xs font-black py-4 hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ETERNAIZANDO...
                    </>
                  ) : 'GRAVAR NO LEGADO DO FDP'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-12">
              <button
                onClick={() => { setIsEditing(false); setTempPreview(null); setTempFile(null); }}
                className="border border-neutral-800 py-4 text-xs font-black text-neutral-600 uppercase hover:bg-neutral-900 transition-all"
              >Arregar (Cancelar)</button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="bg-white text-black py-4 text-xs font-black uppercase hover:bg-neutral-200 transition-all"
              >Salvar Pensamento & Badges</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* HEADER DO PERFIL */}
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className={`absolute -inset-1 blur opacity-30 group-hover:opacity-60 transition duration-1000 ${isElite ? 'bg-yellow-500' : 'bg-red-600'}`}></div>
            <img
              src={player.photo}
              className={`relative w-40 h-40 md:w-56 md:h-56 object-cover border-2 shadow-2xl ${isElite ? 'border-yellow-600 shadow-yellow-600/20' : 'border-neutral-800 grayscale shadow-black/50'}`}
              alt={player.nickname}
            />
            <div className={`absolute -bottom-3 -left-3 px-4 py-2 font-oswald text-sm font-black uppercase tracking-tighter shadow-2xl skew-x-[-10deg] ${isElite ? 'bg-yellow-600 text-black' : 'bg-red-700 text-white'}`}>
              {player.position}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-6">
            <div className="space-y-2">
              <div className="flex flex-col md:flex-row items-baseline gap-3 justify-center md:justify-start">
                <h2 className={`text-6xl md:text-9xl font-oswald font-black uppercase italic tracking-tighter leading-none ${isElite ? 'text-white' : 'text-neutral-300'}`}>
                  {player.nickname}
                </h2>
                {isElite && <span className="text-4xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">👑</span>}
              </div>

              {thought ? (
                <div className="relative inline-block mt-2">
                  <div className="absolute left-0 top-0 w-1 h-full bg-red-600"></div>
                  <p className="pl-4 pr-6 py-2 text-neutral-400 font-mono text-sm italic bg-neutral-900/40 border border-neutral-800/30">
                    "{thought}"
                  </p>
                </div>
              ) : isOwner ? (
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-neutral-600 uppercase hover:text-red-500 transition-all">+ Adicionar Pensamento de Elite</button>
              ) : null}
            </div>

            {/* DESTAQUES (BADGES SELECIONADAS) */}
            <div className="flex flex-wrap justify-center md:justify-start gap-5 pt-2">
              {highBadges.length > 0 ? (
                highBadges.map(bid => <BadgeDisplay key={bid} badgeId={bid} showTitle />)
              ) : (
                player.badges.slice(0, 5).map(bid => <BadgeDisplay key={bid} badgeId={bid} />)
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-4">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-10 py-4 font-oswald font-black uppercase tracking-widest transition-all text-sm border-2 ${isElite ? 'bg-yellow-600 hover:bg-black text-black hover:text-yellow-500 border-yellow-600' : 'bg-neutral-800 hover:bg-white text-white hover:text-black border-neutral-700'}`}
              >
                {isExpanded ? 'Recolher Arquivo ↑' : 'Abrir Dossiê Total ↓'}
              </button>

              {isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-10 py-4 bg-white text-black font-oswald font-black uppercase tracking-widest text-sm hover:bg-red-700 hover:text-white transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                >
                  Personalizar Perfil ⚙️
                </button>
              )}

              {/* SISTEMA DE DEBOCHE (CONTRA O ADVERSÁRIO) */}
              {currentUser && !isOwner && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReportHumiliation('caneta')}
                    className="p-4 bg-black border-2 border-red-900/50 text-red-600 hover:bg-red-900 hover:text-white transition-all text-xs font-black uppercase italic"
                    title="Reportar Caneta"
                  >🖊️ CANETA!</button>
                  <button
                    onClick={() => handleReportHumiliation('chapeu')}
                    className="p-4 bg-black border-2 border-red-900/50 text-red-600 hover:bg-red-900 hover:text-white transition-all text-xs font-black uppercase italic"
                    title="Reportar Chapéu"
                  >👒 CHAPÉU!</button>
                  <button
                    onClick={() => handleReportHumiliation('humilhacao')}
                    className="p-4 bg-black border-2 border-red-900/50 text-red-600 hover:bg-red-900 hover:text-white transition-all text-xs font-black uppercase italic"
                    title="Humilhação Geral"
                  >💀 HUMILHOU</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ÁREA EXPANSÍVEL ADRENALINADA */}
        <div className={`overflow-hidden transition-all duration-1000 ${isExpanded ? 'max-h-[5000px] opacity-100 mt-20' : 'max-h-0 opacity-0'}`}>

          {/* DOSSIÊ E RADAR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 border-t border-neutral-900 pt-16">
            <div className="relative p-8 bg-neutral-900/50 border border-red-900/10 rounded-sm">
              <div className="absolute -top-4 left-8 px-4 py-1 bg-red-600 text-[10px] font-black text-white uppercase tracking-widest font-mono skew-x-[-10deg]">Vantablack Intelligence</div>
              <div className="text-neutral-400 font-mono text-base leading-relaxed mt-4">
                {loadingAi ? (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-ping"></div>
                    <span className="uppercase font-black text-xs text-neutral-600">Sondando a ruindade do elemento...</span>
                  </div>
                ) : <p className="italic border-l-2 border-neutral-800 pl-6">"{aiAnalysis}"</p>}
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex justify-between items-end border-b-2 border-neutral-900 pb-4">
                <h4 className="text-xs text-neutral-500 uppercase font-black tracking-[0.3em]">Moral na Pelada</h4>
                <div className="text-right">
                  <div className="text-5xl font-oswald font-black text-white leading-none">{player.moralScore}</div>
                  <div className="text-[10px] text-red-600 font-mono font-bold uppercase tracking-tighter">Pontuação de Elite</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-neutral-900/30 p-5 border border-neutral-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 -mr-8 -mt-8 rotate-45 transition-all group-hover:bg-white/10"></div>
                  <p className="text-[9px] text-neutral-600 uppercase font-black mb-1 tracking-widest">Matador (Gols)</p>
                  <p className="text-4xl font-oswald font-black text-white">{player.goals}</p>
                </div>
                <div className="bg-neutral-900/30 p-5 border border-neutral-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 -mr-8 -mt-8 rotate-45 transition-all group-hover:bg-white/10"></div>
                  <p className="text-[9px] text-neutral-600 uppercase font-black mb-1 tracking-widest">Garçom (Assists)</p>
                  <p className="text-4xl font-oswald font-black text-white">{player.assists}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ESTANTE DE TROFÉUS (LUXURY DISPLAY) */}
          {trophies.length > 0 && (
            <div className="mt-24 space-y-10">
              <div className="flex items-center gap-6">
                <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-yellow-600/30 to-yellow-600"></div>
                <h3 className="text-xs font-black text-yellow-500 uppercase tracking-[0.5em] text-center px-4">🏆 Estande de Troféus Imortais</h3>
                <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-yellow-600/30 to-yellow-600"></div>
              </div>

              <div className="flex flex-wrap justify-center gap-10">
                {trophies.map(t => (
                  <div key={t.id} className="relative w-56 group">
                    <div className="absolute -inset-4 bg-yellow-600/5 blur-2xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                    <div className="relative aspect-[3/4] overflow-hidden border-4 border-yellow-600 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-neutral-900">
                      {isOwner && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteHeritage(t.id, t.photo); }}
                          className="absolute top-2 right-2 z-20 p-2 bg-red-600/20 hover:bg-red-600 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                          title="Apagar Glória"
                        >
                          🗑️
                        </button>
                      )}
                      <img src={t.photo} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6">
                        <p className="text-sm font-black font-oswald text-white uppercase italic tracking-tighter drop-shadow-md">{t.title}</p>
                        <p className="text-[10px] font-mono text-yellow-500/80 font-bold mt-1">{t.date}</p>
                      </div>
                    </div>
                    {/* SUPORTE DO QUADRO */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4/5 h-1 bg-yellow-900/50 blur-[2px]"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ÁLBUM HERITAGE (GRID ESTILO INSTAGRAM NOIR) */}
          <div className="mt-24 border-t border-neutral-900 pt-20">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.6em] mb-12 text-center">📽️ Álbum Heritage (A História Viva)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {album.map(item => (
                <div
                  key={item.id}
                  className="group relative aspect-square bg-neutral-900 border border-neutral-800 overflow-hidden cursor-pointer"
                  onClick={() => setFullscreenImage(item.photo)}
                >
                  {isOwner && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteHeritage(item.id, item.photo); }}
                      className="absolute top-2 right-2 z-20 p-2 bg-red-600/20 hover:bg-red-600 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                      title="Apagar Memória"
                    >
                      🗑️
                    </button>
                  )}
                  <img src={item.photo} className="w-full h-full object-cover grayscale focus:grayscale-0 group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" alt={item.title} />
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                    <p className="text-xs font-black font-oswald text-white uppercase leading-tight transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">{item.title}</p>
                    <p className="text-[9px] font-mono text-red-600 mt-2 font-bold">{item.date}</p>
                  </div>
                </div>
              ))}
              {isOwner && (
                <div
                  onClick={() => setIsEditing(true)}
                  className="aspect-square border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center cursor-pointer hover:border-red-600 hover:bg-red-600/5 transition-all group"
                >
                  <span className="text-4xl text-neutral-700 group-hover:text-red-600 transition-colors">+</span>
                  <span className="text-[9px] font-black text-neutral-700 uppercase mt-2 group-hover:text-red-600">Postar Memória</span>
                </div>
              )}
            </div>
          </div>

          {/* O RESTO DAS BADGES (GALERIA SECUNDÁRIA) */}
          <div className="mt-24 border-t border-neutral-900 pt-12 pb-10">
            <h4 className="text-[10px] font-black text-neutral-700 uppercase mb-8 tracking-[0.4em]">Honraria de Base & Infâmias</h4>
            <div className="flex flex-wrap gap-6 opacity-60 hover:opacity-100 transition-opacity">
              {player.badges.filter(bid => !highBadges.includes(bid)).map(bid => <BadgeDisplay key={bid} badgeId={bid} />)}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL FULLSCREEN */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 md:p-10 cursor-zoom-out animate-in fade-in duration-300"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            src={fullscreenImage}
            className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(255,255,255,0.05)]"
          />
          <button className="absolute top-6 right-6 text-white text-3xl font-black">✕</button>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
