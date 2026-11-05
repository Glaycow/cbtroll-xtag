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
}

export interface Draw {
  teamA: string[];
  teamB: string[];
  roles: Record<string, Role>;
  card: Card;
  captainA?: string;
  captainB?: string;
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
