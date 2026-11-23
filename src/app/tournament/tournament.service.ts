import { Injectable, signal, computed, effect } from '@angular/core';
import { Card, Champ, Draw, Elo, Match, Player, Role, Standing, Winner } from './tournament.models';
import { CHAMP_ROLES } from './champion-roles';

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
  { nome: 'Campeão obrigatório', desc: 'Cada jogador joga com o campeão que o organizador sortear' },
  { nome: 'Draft automático', desc: 'Cada jogador recebe um campeão aleatório da sua rota', draft: true }
];

const ROLE_TAGS: Record<Role, string[]> = {
  Topo: ['Fighter', 'Tank'],
  Selva: ['Fighter', 'Assassin', 'Tank'],
  Meio: ['Mage', 'Assassin'],
  Atirador: ['Marksman'],
  Suporte: ['Support', 'Mage', 'Tank'],
};

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

/** Diferença máxima de elo (soma dos times) aceita como equilibrada. */
export const SPLIT_TOLERANCE = 150;

/**
 * Divide os jogadores em 2 times equilibrados por elo.
 * Entre as divisões dentro da tolerância, sorteia uma e evita repetir times das partidas recentes.
 */
export const balancedSplit = (sel: Player[], recent: string[][] = []): { A: Player[]; B: Player[] } => {
  const total = sel.reduce((s, p) => s + eloScore(p), 0);
  const key = (ids: string[]) => [...ids].sort().join(',');
  const recentKeys = new Set(recent.map(key));

  const options = combinations(sel.length, sel.length / 2)
    .filter(comb => comb.includes(0)) // evita duplicar o mesmo corte com os times invertidos
    .map(comb => {
      const sumA = comb.reduce((s, i) => s + eloScore(sel[i]), 0);
      const idsA = comb.map(i => sel[i].id);
      const idsB = sel.filter((_, i) => !comb.includes(i)).map(p => p.id);
      return {
        comb,
        diff: Math.abs(2 * sumA - total),
        repeat: recentKeys.has(key(idsA)) || recentKeys.has(key(idsB)),
      };
    });

  const best = Math.min(...options.map(o => o.diff));
  const close = options.filter(o => o.diff <= best + SPLIT_TOLERANCE);
  const fresh = close.filter(o => !o.repeat);
  const pool = fresh.length ? fresh : close;
  const pick = pool[Math.floor(Math.random() * pool.length)].comb;

  return {
    A: pick.map(i => sel[i]),
    B: sel.filter((_, i) => !pick.includes(i)),
  };
};

const permutations = <T>(arr: T[]): T[][] =>
  arr.length <= 1 ? [arr] : arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p]));

/** Quantos jogadores repetiram a rota que já fizeram em alguma partida da janela. */
const repeats = (roles: Record<string, Role>, window: Match[]): number =>
  Object.entries(roles).reduce((n, [id, role]) => n + (window.some(m => m.roles[id] === role) ? 1 : 0), 0);

/**
 * Atribui rotas a cada time. Prioridade: não repetir a rota da partida anterior;
 * depois, evitar repetir a rota das 2 últimas partidas. Empates são sorteados.
 */
export const assignRoles = (teamA: string[], teamB: string[], history: Match[]): Record<string, Role> => {
  const last1 = history.slice(-1);
  const last2 = history.slice(-2);
  let bestScore = Infinity;
  let ties: Record<string, Role>[] = [];
  for (const pa of permutations(ROLES)) {
    for (const pb of permutations(ROLES)) {
      const roles: Record<string, Role> = {};
      teamA.forEach((id, i) => { roles[id] = pa[i]; });
      teamB.forEach((id, i) => { roles[id] = pb[i]; });
      const score = repeats(roles, last1) * 100 + repeats(roles, last2);
      if (score < bestScore) { bestScore = score; ties = [roles]; }
      else if (score === bestScore) ties.push(roles);
    }
  }
  return ties[Math.floor(Math.random() * ties.length)];
};

@Injectable({ providedIn: 'root' })
export class TournamentService {
  readonly players = signal<Player[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly matches = signal<Match[]>([]);
  readonly current = signal<Draw | null>(null);
  readonly champPool = signal<Champ[]>([]);
  readonly ddVersion = signal<string>('');

  constructor() {
    this.load();
    this.loadChampions();
    effect(() => this.persist(this.snapshot()));
  }

  /** Carrega a lista de campeões (Data Dragon, pt_BR). */
  async loadChampions(): Promise<void> {
    try {
      const versions: string[] = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
      const v = versions[0];
      const data = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/pt_BR/champion.json`)).json();
      const list = Object.values(data.data as Record<string, { id: string; name: string; tags?: string[] }>)
        .map(c => ({ id: c.id, nome: c.name, tags: c.tags ?? [] }));
      this.ddVersion.set(v);
      this.champPool.set(list);
    } catch {
      /* sem campeões: o draft fica sem campeões */
    }
  }

  /** Recarrega os campeões e sorteia o draft da partida atual, se ainda não houver. */
  async retryChampions(): Promise<void> {
    await this.loadChampions();
    const d = this.current();
    if (d && d.card.draft && !d.champions) {
      this.current.set({ ...d, champions: this.draftChampions(d.roles) });
    }
  }

  private ensureDraftCard(cards: Card[]): Card[] {
    if (cards.some(c => c.draft)) return cards;
    const draft = DEFAULT_CARDS.find(c => c.draft)!;
    return [...cards, { ...draft, id: uid() }];
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
      if (Array.isArray(s.cards)) this.cards.set(this.ensureDraftCard(s.cards));
      if (Array.isArray(s.matches)) this.matches.set(s.matches);
      if (s.current) this.current.set(s.current);
    } catch {
      /* dados corrompidos: começa vazio */
    }
  }

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

  /** Um campeão único por jogador, preferindo campeões da rota dele. */
  private draftChampions(roles: Record<string, Role>): Record<string, Champ> | undefined {
    const pool = this.champPool();
    if (!pool.length) return undefined;
    const used = new Set<string>();
    const out: Record<string, Champ> = {};
    for (const [pid, role] of Object.entries(roles)) {
      const free = pool.filter(c => !used.has(c.id));
      const byRole = free.filter(c => CHAMP_ROLES[c.id]?.includes(role));
      const byTags = free.filter(c => c.tags.some(t => ROLE_TAGS[role].includes(t)));
      const list = byRole.length ? byRole : byTags.length ? byTags : free;
      const c = list[Math.floor(Math.random() * list.length)];
      used.add(c.id);
      out[pid] = c;
    }
    return out;
  }

  /** Sorteia 10 jogadores em 2 times de 5 equilibrados por elo, com rota única, capitão aleatório por time e uma carta. */
  draw(): Draw | null {
    const players = this.players();
    if (players.length < PLAYERS_PER_MATCH) return null;
    const card = this.pickCard();
    if (!card) return null;
    const sel = shuffle(players).slice(0, PLAYERS_PER_MATCH);
    const recent = this.matches().slice(-3).flatMap(m => [m.teamA, m.teamB]);
    const { A, B } = balancedSplit(sel, recent);
    const teamA = A.map(p => p.id);
    const teamB = B.map(p => p.id);
    const roles = assignRoles(teamA, teamB, this.matches());
    const pickOne = (ids: string[]) => ids[Math.floor(Math.random() * ids.length)];
    const champions = card.draft ? this.draftChampions(roles) : undefined;
    const draw: Draw = { teamA, teamB, roles, card, captainA: pickOne(teamA), captainB: pickOne(teamB), champions };
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
    let champions = d.champions;
    if (champions?.[oldId]) {
      champions = { ...champions, [newId]: champions[oldId] };
      delete champions[oldId];
    }
    this.current.set({ ...d, teamA: sw(d.teamA), teamB: sw(d.teamB), roles, captainA: cap(d.captainA), captainB: cap(d.captainB), champions });
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
