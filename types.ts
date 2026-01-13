
export enum PlayerStatus {
  HOT = '🔥 Em alta',
  NORMAL = '😐 Normal',
  LOW = '🤡 Em baixa',
  GHOST = '🧊 Sumido'
}

export enum Position {
  GOLEIRO = 'Goleiro',
  LINHA = 'Linha'
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'Geral' | 'Linha' | 'Goleiro' | 'Elite' | 'Honra' | 'Architect';
}

export interface HeritageItem {
  id: string;
  player_id: string;
  title: string;
  photo: string;
  date: string;
  type: 'album' | 'trophy';
  tagged_players?: string[]; // IDs
  likes_count?: number;
  comments_count?: number;
}

export interface SpecialEvent {
  id: string;
  player_id: string;
  type: 'puskas' | 'vexame' | 'quebra_bola' | 'resenha';
  description: string;
  date: string;
}

export interface Player {
  id: string;
  name: string;
  nickname: string;
  password?: string;
  photo: string;
  position: Position;
  matchesPlayed: number;
  goals: number;
  assists: number;
  wins?: number;
  losses?: number;
  bestVotes: number;
  worstVotes: number;
  moralScore: number;
  status: PlayerStatus;
  badges: string[]; // IDs
  high_badges?: string[]; // IDs das 5 badges em destaque
  thought?: string; // Pensamento do dia
  debt: number;
  isPaid: boolean;
  specialEvents: SpecialEvent[];
  heritage?: HeritageItem[];
  invited_by?: string;
  is_admin?: boolean;
}

export interface MatchSession {
  id: string;
  status: 'resenha' | 'partida' | 'vago' | 'votacao_aberta' | 'em_jogo' | 'finalizado';
  votingOpen: boolean;
  playersPresent: string[];
  matchDay?: number;
  manualVotingStatus?: 'auto' | 'open' | 'closed';
}
export interface FinancialGoal {
  id: string;
  title: string;
  target: number;
  current: number;
}

export interface GlobalFinances {
  id: number;
  total_balance: number;
  goals: FinancialGoal[];
}
