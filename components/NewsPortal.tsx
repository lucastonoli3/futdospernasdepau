import React, { useEffect, useState } from 'react';
import { Player } from '../types';
import { supabase } from '../services/supabaseClient';
import { CLUB, SOCIAL, FEATURED_IG_POSTS } from '../brandConfig';
import Logo from './Logo';

interface NewsItem {
  id: string;
  title: string;
  body: string;
  image?: string;
  link?: string;
  pinned?: boolean;
  created_at: string;
}

interface NewsPortalProps {
  currentUser?: Player | null;
}

/**
 * Portal de Notícias do Balaio de Gato FC.
 * - Vitrine institucional + atalho para o Instagram @balaiodegato_of
 * - Posts em destaque do Instagram (embed oficial) configurados no brandConfig
 * - Mural de avisos da diretoria (tabela `news` no Supabase, com fallback)
 */
const NewsPortal: React.FC<NewsPortalProps> = ({ currentUser }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', link: '', pinned: false });
  const [saving, setSaving] = useState(false);

  const isAdmin = !!currentUser?.is_admin;

  // Posts do Instagram = links colados pela diretoria nos avisos + destaques fixos do brandConfig
  const isIgPostUrl = (url?: string | null) => !!url && /instagram\.com\/(p|reel|tv)\//i.test(url);
  const igPosts = Array.from(new Set([
    ...news.filter(n => isIgPostUrl(n.link)).map(n => n.link as string),
    ...FEATURED_IG_POSTS,
  ]));

  useEffect(() => {
    fetchNews();
  }, []);

  // Processa os embeds do Instagram depois que o DOM renderiza
  useEffect(() => {
    if (igPosts.length === 0) return;
    const SCRIPT_ID = 'ig-embed-script';
    const process = () => (window as any).instgrm?.Embeds?.process();
    if (document.getElementById(SCRIPT_ID)) {
      // re-processa a cada mudança na lista (novos avisos com link)
      setTimeout(process, 100);
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = process;
    document.body.appendChild(s);
  }, [loading, igPosts.length]);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) {
        setTableMissing(true);
      } else {
        setNews((data as NewsItem[]) || []);
      }
    } catch (e) {
      setTableMissing(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('news').insert([{
        title: draft.title.trim(),
        body: draft.body.trim(),
        link: draft.link.trim() || null,
        pinned: draft.pinned,
        author_nickname: currentUser?.nickname || 'Diretoria',
      }]);
      if (error) throw error;
      setDraft({ title: '', body: '', link: '', pinned: false });
      setShowComposer(false);
      fetchNews();
    } catch (e) {
      alert('Não consegui publicar. Confira se a tabela "news" existe no Supabase (rode a migração).');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este aviso do mural?')) return;
    await supabase.from('news').delete().eq('id', id);
    fetchNews();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 animate-slide-up">
      {/* HERO INSTITUCIONAL */}
      <div className="relative overflow-hidden rounded-[32px] border border-gold/20 brand-gradient bg-neutral-900/40 p-8 md:p-10">
        <div className="absolute -right-8 -top-8 opacity-[0.08] select-none pointer-events-none">
          <Logo size={200} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <Logo size={64} className="shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-gold uppercase tracking-[0.5em] mb-2">Portal de Notícias</p>
              <h2 className="font-oswald text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-none">
                {CLUB.name}
              </h2>
              <p className="text-neutral-400 font-mono text-[11px] uppercase tracking-widest mt-3">{CLUB.tagline}</p>
            </div>
          </div>
          <a
            href={SOCIAL.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-3 px-6 py-4 rounded-2xl font-oswald font-black uppercase italic text-sm text-black bg-gold hover:bg-gold-600 transition-all active:scale-95 gold-glow"
          >
            <span className="text-xl">📸</span>
            Seguir @{SOCIAL.instagramHandle}
          </a>
        </div>
      </div>

      {/* MURAL DA DIRETORIA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title text-gold text-2xl flex items-center gap-3"><span>📢</span> Avisos da Diretoria</h3>
          {isAdmin && (
            <button
              onClick={() => setShowComposer(s => !s)}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gold/40 text-gold hover:bg-gold hover:text-black transition-all"
            >
              {showComposer ? 'Cancelar' : '+ Novo Aviso'}
            </button>
          )}
        </div>

        {isAdmin && showComposer && (
          <div className="glass-panel border-gold/20 rounded-2xl p-5 space-y-3">
            <input
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="Título do aviso (ex: Jogo de domingo confirmado!)"
              className="w-full bg-black border border-neutral-800 p-3 text-white font-oswald uppercase italic text-sm rounded-xl outline-none focus:border-gold"
            />
            <textarea
              value={draft.body}
              onChange={e => setDraft({ ...draft, body: e.target.value })}
              placeholder="Detalhes do aviso..."
              className="w-full bg-black border border-neutral-800 p-3 text-neutral-200 text-sm rounded-xl outline-none focus:border-gold h-24 resize-none"
            />
            <input
              value={draft.link}
              onChange={e => setDraft({ ...draft, link: e.target.value })}
              placeholder="Cole o link de um post do Instagram e ele aparece incorporado aqui 👇"
              className="w-full bg-black border border-neutral-800 p-3 text-neutral-200 text-xs font-mono rounded-xl outline-none focus:border-gold"
            />
            {isIgPostUrl(draft.link) && (
              <p className="text-[11px] text-pitch-400 font-bold">✓ Link do Instagram detectado — o post vai aparecer incorporado no portal.</p>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase text-neutral-400 cursor-pointer">
                <input type="checkbox" checked={draft.pinned} onChange={e => setDraft({ ...draft, pinned: e.target.checked })} />
                Fixar no topo
              </label>
              <button
                onClick={handlePublish}
                disabled={saving || !draft.title.trim()}
                className="px-6 py-3 rounded-xl bg-gold text-black font-oswald font-black uppercase italic text-xs disabled:opacity-30 hover:bg-gold-600 transition-all"
              >
                {saving ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : news.length > 0 ? (
          <div className="space-y-3">
            {news.map(n => (
              <article key={n.id} className={`relative glass-panel rounded-2xl p-5 border ${n.pinned ? 'border-gold/40' : 'border-white/5'}`}>
                {n.pinned && <span className="absolute top-4 right-4 text-[9px] font-black uppercase text-gold tracking-widest">📌 Fixado</span>}
                <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-1">
                  {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <h4 className="font-oswald text-xl font-black uppercase italic text-white leading-tight">{n.title}</h4>
                {n.body && <p className="text-sm text-neutral-300 leading-relaxed mt-2 whitespace-pre-line">{n.body}</p>}
                {n.link && (
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[11px] font-black uppercase text-gold hover:underline">
                    Ver mais →
                  </a>
                )}
                {isAdmin && (
                  <button onClick={() => handleDelete(n.id)} className="absolute bottom-4 right-4 text-[10px] text-neutral-600 hover:text-red-500 uppercase font-black">Excluir</button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-10 text-center border border-dashed border-neutral-800">
            <div className="flex justify-center"><Logo size={48} /></div>
            <p className="text-neutral-400 font-oswald uppercase italic text-lg mt-3">Nenhum aviso por enquanto</p>
            <p className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest mt-2">
              {tableMissing
                ? 'Crie a tabela "news" no Supabase (migração incluída) para a diretoria postar avisos aqui.'
                : 'A diretoria ainda não publicou nada. Fique de olho no Instagram!'}
            </p>
          </div>
        )}
      </section>

      {/* INSTAGRAM EM DESTAQUE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="section-title text-gold text-2xl flex items-center gap-3"><span>📸</span> No Instagram</h3>
          <a
            href={SOCIAL.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-gold/40 text-gold hover:bg-gold hover:text-black transition-all"
          >
            @{SOCIAL.instagramHandle} ↗
          </a>
        </div>

        {igPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {igPosts.map((url) => (
              <div key={url} className="rounded-2xl overflow-hidden border border-gold/15 bg-neutral-900/40">
                <blockquote
                  className="instagram-media"
                  data-instgrm-permalink={url}
                  data-instgrm-version="14"
                  data-instgrm-captioned
                  style={{ background: '#0a0a0a', border: 0, margin: 0, width: '100%', minHeight: 380 }}
                >
                  {/* Fallback enquanto o embed carrega (ou se for bloqueado) */}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block p-8 text-center text-gold font-oswald font-black uppercase italic">
                    Ver post no Instagram ↗
                  </a>
                </blockquote>
              </div>
            ))}
          </div>
        ) : (
          <a
            href={SOCIAL.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block glass-panel rounded-2xl p-8 text-center border border-gold/20 hover:border-gold/50 transition-all group"
          >
            <span className="text-5xl block mb-3 group-hover:scale-110 transition-transform">📸</span>
            <p className="font-oswald text-2xl font-black uppercase italic text-white">@{SOCIAL.instagramHandle}</p>
            <p className="text-neutral-400 font-mono text-[11px] uppercase tracking-widest mt-2">
              Siga o clube no Instagram — fotos, resultados e bastidores
            </p>
            <span className="inline-block mt-4 px-6 py-3 rounded-xl bg-gold text-black font-oswald font-black uppercase italic text-xs">
              Abrir Instagram
            </span>
            {isAdmin && (
              <span className="block mt-4 text-[11px] text-neutral-500 normal-case">
                Dica da diretoria: publique um aviso com o link de um post e ele aparece incorporado aqui.
              </span>
            )}
          </a>
        )}
      </section>
    </div>
  );
};

export default NewsPortal;
