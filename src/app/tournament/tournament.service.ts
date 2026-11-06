import { Injectable, signal, computed, effect } from '@angular/core';
import { Card, Draw, Elo, Match, Player, PlayerStats, PlayerTotals, Role, Standing, Winner } from './tournament.models';

export const ROLES: Role[] = ['Topo', 'Selva', 'Meio', 'Atirador', 'Suporte'];
export const PLAYERS_PER_MATCH = 10;
export const CARD_COOLDOWN = 3;
const STORAGE_KEY = 'cbtroll-xtag:v1';

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

const TIER_BASE: Record<string, number> = {
  IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600, EMERALD: 2000,
  DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 2800, CHALLENGER: 2800,
};
const DIV_BONUS: Record<string, number> = { IV: 0, III: 100, II: 200, I: 300 };
export const UNRANKED_SCORE = 800;

/** Pontuação numérica do elo solo: tier + divisão + PDL. Sem ranqueada = UNRANKED_SCORE. */
export const eloScore = (p: Player): number => {
  const e = p.elo;
  if (!e?.tier) return UNRANKED_SCORE;
  const base = TIER_BASE[e.tier] ?? UNRANKED_SCORE;
  const div = DIV_BONUS[e.rank ?? ''] ?? 0;
  return base + div + (e.lp ?? 0);
};

const combinations = (n: number, k: number, start = 0, cur: number[] = [], out: number[][] = []): number[][] => {
  if (cur.length === k) { out.push([...cur]); return out; }
  for (let i = start; i < n; i++) {
    cur.push(i);
    combinations(n, k, i + 1, cur, out);
    cur.pop();
  }
  return out;
};

/** Divide os jogadores em 2 times com a menor diferença de elo; empates são sorteados. */
export const balancedSplit = (sel: Player[]): { A: Player[]; B: Player[] } => {
  const total = sel.reduce((s, p) => s + eloScore(p), 0);
  let best = Infinity;
  let options: number[][] = [];
  for (const comb of combinations(sel.length, sel.length / 2)) {
    if (!comb.includes(0)) continue; // evita duplicar o mesmo corte com os times invertidos
    const sumA = comb.reduce((s, i) => s + eloScore(sel[i]), 0);
    const diff = Math.abs(2 * sumA - total);
    if (diff < best) { best = diff; options = [comb]; }
    else if (diff === best) options.push(comb);
  }
  const pick = options[Math.floor(Math.random() * options.length)];
  return {
    A: pick.map(i => sel[i]),
    B: sel.filter((_, i) => !pick.includes(i)),
  };
};

@Injectable({ providedIn: 'root' })
export class TournamentService {
  readonly players = signal<Player[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly matches = signal<Match[]>([]);
  readonly current = signal<Draw | null>(null);

  constructor() {
    this.load();
    effect(() => this.persist(this.snapshot()));
  }

  /** Grava no navegador. Também roda automaticamente a cada mudança. */
  saveNow(): void {
    this.persist(this.snapshot());
  }

  reset(): void {
    this.players.set([]);
    this.cards.set([]);
    this.matches.set([]);
    this.current.set(null);
  }

  private snapshot() {
    return { players: this.players(), cards: this.cards(), matches: this.matches(), current: this.current() };
  }

  private persist(data: unknown): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* armazenamento indisponível */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s.players)) this.players.set(s.players);
      if (Array.isArray(s.cards)) this.cards.set(s.cards);
      if (Array.isArray(s.matches)) this.matches.set(s.matches);
      if (s.current) this.current.set(s.current);
    } catch {
      /* dados corrompidos: começa vazio */
    }
  }

  readonly totals = computed<PlayerTotals[]>(() => {
    const map = new Map<string, PlayerTotals>();
    this.players().forEach(p => map.set(p.id, { player: p, k: 0, d: 0, a: 0, dano: 0, jogos: 0 }));
    for (const m of this.matches()) {
      for (const [id, st] of Object.entries(m.stats ?? {})) {
        const t = map.get(id);
        if (!t) continue;
        t.k += st.k; t.d += st.d; t.a += st.a; t.dano += st.dano; t.jogos++;
      }
    }
    return [...map.values()];
  });

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

  /** Sorteia 10 jogadores em 2 times de 5 equilibrados por elo, com rota única, capitão aleatório por time e uma carta. */
  draw(): Draw | null {
    const players = this.players();
    if (players.length < PLAYERS_PER_MATCH) return null;
    const card = this.pickCard();
    if (!card) return null;
    const sel = shuffle(players).slice(0, PLAYERS_PER_MATCH);
    const { A, B } = balancedSplit(sel);
    const rA = shuffle(ROLES), rB = shuffle(ROLES);
    const roles: Record<string, Role> = {};
    const teamA = A.map((p, i) => { roles[p.id] = rA[i]; return p.id; });
    const teamB = B.map((p, i) => { roles[p.id] = rB[i]; return p.id; });
    const pickOne = (ids: string[]) => ids[Math.floor(Math.random() * ids.length)];
    const draw: Draw = { teamA, teamB, roles, card, captainA: pickOne(teamA), captainB: pickOne(teamB) };
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
    const cap = (c?: string) => (c === oldId ? newId : c);
    this.current.set({ ...d, teamA: sw(d.teamA), teamB: sw(d.teamB), roles, captainA: cap(d.captainA), captainB: cap(d.captainB) });
  }


  saveMatch(winner: Winner): void {
    const d = this.current();
    if (!d) return;
    const match: Match = { ...d, id: uid(), ts: Date.now(), cardId: d.card.id, winner };
    this.matches.update(list => [...list, match]);
    this.current.set(null);
  }

  setStat(matchId: string, playerId: string, field: keyof PlayerStats, value: number): void {
    this.matches.update(list => list.map(m => {
      if (m.id !== matchId) return m;
      const cur = m.stats?.[playerId] ?? { k: 0, d: 0, a: 0, dano: 0 };
      return { ...m, stats: { ...(m.stats ?? {}), [playerId]: { ...cur, [field]: Math.max(0, value) } } };
    }));
  }

  removeMatch(id: string): void {
    this.matches.update(list => list.filter(m => m.id !== id));
  }
}
