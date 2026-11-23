export type Role = 'Topo' | 'Selva' | 'Meio' | 'Atirador' | 'Suporte';
export type Winner = 'A' | 'B';

export interface Elo {
  tier: string | null;
  rank: string | null;
  lp: number | null;
  vitorias: number;
  derrotas: number;
}

export interface Player {
  id: string;
  nome: string;
  riot?: string;
  elo?: Elo;
}

export interface Card {
  id: string;
  nome: string;
  desc: string;
  draft?: boolean;
}

export interface Champ {
  id: string;
  nome: string;
  tags: string[];
}

export interface Draw {
  teamA: string[];
  teamB: string[];
  roles: Record<string, Role>;
  card: Card;
  captainA?: string;
  captainB?: string;
  champions?: Record<string, Champ>;
}

export interface Match extends Draw {
  id: string;
  ts: number;
  cardId: string;
  winner: Winner;
}

export interface Standing {
  player: Player;
  wins: number;
  losses: number;
  points: number;
}
