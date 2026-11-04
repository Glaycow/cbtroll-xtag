export type Role = 'Topo' | 'Selva' | 'Meio' | 'Atirador' | 'Suporte';
export type Winner = 'A' | 'B';

export interface Player {
  id: string;
  nome: string;
  riot?: string;
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
