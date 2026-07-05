/**
 * ============================================================
 *  BALAIO DE GATO FC — CONFIGURAÇÃO CENTRAL DE MARCA
 * ============================================================
 *  Ponto único de verdade para identidade, contatos, caixa e
 *  regras do clube. Mudou o PIX? O Instagram? O valor da
 *  mensalidade? Mexe SÓ aqui que reflete no app inteiro.
 * ============================================================
 */

export const CLUB = {
  name: 'Balaio de Gato FC',
  shortName: 'Balaio FC',
  initials: 'BGFC',
  tagline: 'Futebol de Campo • Resenha • Família',
  city: 'Cariacica - ES',
  founded: 2024,
  /** Escudo oficial do clube (vetorial, fundo transparente) */
  logo: '/escudo.svg',
  ball: '⚽',
};

export const SOCIAL = {
  instagramHandle: 'balaiodegato_of',
  get instagramUrl() {
    return `https://www.instagram.com/${this.instagramHandle}/`;
  },
  /** Link do grupo/contato (ajuste quando tiver) */
  whatsappInvite: '',
};

/**
 * POSTS EM DESTAQUE DO INSTAGRAM (portal de notícias).
 * Cole aqui o LINK (permalink) de posts/reels do @balaiodegato_of para
 * eles aparecerem embutidos na aba Notícias. Ex.:
 *   'https://www.instagram.com/p/CXXXXXXXXXX/'
 * Deixe vazio que o app mostra só o atalho pro perfil.
 */
export const FEATURED_IG_POSTS: string[] = [];

/**
 * CAIXA / TESOURARIA
 * A pelada é por MENSALIDADE: todo mundo paga uma vez por mês,
 * normalmente no primeiro domingo (dias 05–07).
 */
export const CAIXA = {
  /** Valor padrão da mensalidade (R$). Pode ser ajustado pela diretoria. */
  mensalidadeDefault: 30,
  /** Janela de vencimento da mensalidade (dias do mês) */
  dueDayStart: 5,
  dueDayEnd: 7,
  /** Chave PIX da diretoria (celular) */
  pix: {
    key: '27999359431',
    keyType: 'Telefone' as 'CPF/CNPJ' | 'E-mail' | 'Telefone' | 'Aleatória',
    holderName: 'Diretoria Balaio de Gato FC',
    bank: '',
  },
};

/**
 * DIRETORIA — quem tem acesso ao painel administrativo.
 * (mantém compat com a lista antiga de nicknames)
 */
export const DIRETORIA_NICKNAMES = ['tonoli', 'cleitim', 'markin', 'cleiton', 'marquinho', 'marquinhos'];

/**
 * PALETA DA MARCA (preto + dourado + verde campo)
 * Use as classes Tailwind `gold` / `pitch` definidas no index.html.
 */
export const BRAND_COLORS = {
  gold: '#F5C518',
  goldSoft: '#F7D44C',
  pitch: '#15803d',
  pitchBright: '#22c55e',
  ink: '#0a0a0a',
  danger: '#dc2626',
};

/** Helper para montar o "payload" do PIX copia-e-cola simples (chave). */
export const buildPixPayload = () => CAIXA.pix.key;

/** Mês de referência atual no formato YYYY-MM (usado na tesouraria). */
export const currentMonthRef = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Nome amigável do mês (ex.: "Junho/2026"). */
export const monthLabel = (ref: string) => {
  const [y, m] = ref.split('-').map(Number);
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[(m || 1) - 1]}/${y}`;
};
