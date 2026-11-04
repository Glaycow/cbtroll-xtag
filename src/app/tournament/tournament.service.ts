import { Injectable, signal, computed } from '@angular/core';
import { Card, Draw, Elo, Match, Player, Role, Standing, Winner } from './tournament.models';

export const ROLES: Role[] = ['Topo', 'Selva', 'Meio', 'Atirador', 'Suporte'];
export const PLAYERS_PER_MATCH = 10;
export const CARD_COOLDOWN = 3;

export const DEFAULT_CARDS: Omit<Card, 'id'>[] = [
  { nome: 'Ban extra', desc: 'Cada time bane 1 campeão a mais' },
  { nome: 'Troca de rota', desc: '1 jogador de cada time troca de rota com outro do próprio time' },
  { nome: 'Campeão proibido', desc: '1 campeão sorteado fica banido para os dois times' },
  { nome: 'Ouro inicial', desc: 'Cada time começa com 500 de ouro a mais' },
  { nome: 'Carta dupla', desc: 'O time perdedor da partida anterior recebe +1 carta' },
  { nome: 'Campeão obrigatório', desc: 'Cada jogador joga com o campeão que o organizador sortear' }
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

@Injectable({ providedIn: 'root' })
export class TournamentService {
  readonly players = signal<Player[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly matches = signal<Match[]>([]);
  readonly current = signal<Draw | null>(null);

  readonly standings = computed<Standing[]>(() => {
    const map = new Map<string, Standing>();
    this.players().forEach(p => map.set(p.id, { player: p, wins: 0, losses: 0, points: 0 }));
    for (const m of this.matches()) {
      const winners = m.winner === 'A' ? m.teamA : m.teamB;
      const losers = m.winner === 'A' ? m.teamB : m.teamA;
      winners.forEach(id => { const s = map.get(id); if (s) { s.wins++; s.points += 3; } });
      losers.forEach(id => { const s = map.get(id); if (s) s.losses++; });
    }
    return [...map.values()].sort(
      (a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses || a.player.nome.localeCompare(b.player.nome)
    );
  });

  addPlayer(nome: string, riot = '', elo?: Elo): void {
    const name = nome.trim();
    if (!name) return;
    this.players.update(list => [...list, { id: uid(), nome: name, riot: riot.trim(), elo }]);
  }

  removePlayer(id: string): void {
    this.players.update(list => list.filter(p => p.id !== id));
  }

  addCard(nome: string, desc = ''): void {
    const name = nome.trim();
    if (!name) return;
    this.cards.update(list => [...list, { id: uid(), nome: name, desc: desc.trim() }]);
  }

  removeCard(id: string): void {
    this.cards.update(list => list.filter(c => c.id !== id));
  }

  seedCards(): void {
    if (this.cards().length) return;
    this.cards.set(DEFAULT_CARDS.map(c => ({ ...c, id: uid() })));
  }

  /** Carta que não saiu nas últimas CARD_COOLDOWN partidas. */
  pickCard(): Card | null {
    const cards = this.cards();
    if (!cards.length) return null;
    const recent = this.matches().slice(-CARD_COOLDOWN).map(m => m.cardId);
    let pool = cards.filter(c => !recent.includes(c.id));
    if (!pool.length) {
      const last = this.matches().at(-1)?.cardId;
      pool = cards.filter(c => c.id !== last);
      if (!pool.length) pool = cards;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Sorteia 10 jogadores em 2 times de 5, com uma rota única por time e uma carta. */
  draw(): Draw | null {
    const players = this.players();
    if (players.length < PLAYERS_PER_MATCH) return null;
    const card = this.pickCard();
    if (!card) return null;
    const sel = shuffle(players).slice(0, PLAYERS_PER_MATCH);
    const rA = shuffle(ROLES), rB = shuffle(ROLES);
    const roles: Record<string, Role> = {};
    const teamA = sel.slice(0, 5).map((p, i) => { roles[p.id] = rA[i]; return p.id; });
    const teamB = sel.slice(5).map((p, i) => { roles[p.id] = rB[i]; return p.id; });
    const draw: Draw = { teamA, teamB, roles, card };
    this.current.set(draw);
    return draw;
  }

  /** Troca um jogador da prévia por um do banco, mantendo a rota. */
  swapPlayer(oldId: string, newId: string): void {
    const d = this.current();
    if (!d || oldId === newId) return;
    const sw = (arr: string[]) => arr.map(x => (x === oldId ? newId : x));
    const roles = { ...d.roles, [newId]: d.roles[oldId] };
    delete roles[oldId];
    this.current.set({ ...d, teamA: sw(d.teamA), teamB: sw(d.teamB), roles });
  }

  saveMatch(winner: Winner): void {
    const d = this.current();
    if (!d) return;
    const match: Match = { ...d, id: uid(), ts: Date.now(), cardId: d.card.id, winner };
    this.matches.update(list => [...list, match]);
    this.current.set(null);
  }

  removeMatch(id: string): void {
    this.matches.update(list => list.filter(m => m.id !== id));
  }
}
