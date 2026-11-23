import { Component, computed, inject, signal } from '@angular/core';
import { TournamentService } from './tournament/tournament.service';
import { Card, Draw, Elo, Role, Winner } from './tournament/tournament.models';

const REGIAO = 'br1';
const ROLE_KEY: Record<string, string> = { Topo: 'top', Selva: 'jungle', Meio: 'mid', Atirador: 'adc', Suporte: 'sup' };
const ROLE_ICON: Record<string, string> = { Topo: '⚔', Selva: '🌿', Meio: '✦', Atirador: '🏹', Suporte: '✚' };

const REEL_LEN = 36;
const REEL_TARGET = 30;
const CARD_STEP = 122; // largura da carta + espaço
const CARD_HALF = 56;

type Stage = 'idle' | 'players' | 'card' | 'teams';

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly t = inject(TournamentService);

  readonly drawMsg = signal('');
  readonly addMsg = signal('');
  readonly savedMsg = signal('');

  readonly stage = signal<Stage>('idle');
  readonly spin = signal<string[]>([]);
  readonly reelItems = signal<Card[]>([]);
  readonly reelX = signal(0);
  readonly reelGo = signal(false);

  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly bench = computed(() => {
    const d = this.t.current();
    if (!d) return [];
    const used = new Set([...d.teamA, ...d.teamB]);
    return this.t.players().filter(p => !used.has(p.id));
  });

  readonly leader = computed(() => {
    const s = this.t.standings();
    if (!s.length || !this.t.matches().length) return '—';
    return s[0].player.nome.split(' ')[0];
  });

  readonly coolingIds = computed(() => new Set(this.t.matches().slice(-3).map(m => m.card.id)));

  isCooling(cardId: string): boolean {
    return this.coolingIds().has(cardId);
  }

  roleKey(role: Role): string {
    return ROLE_KEY[role] ?? 'top';
  }

  roleIcon(role: Role): string {
    return ROLE_ICON[role] ?? '•';
  }

  rankClass(i: number): string {
    return i < 3 && this.t.matches().length ? `g${i + 1}` : '';
  }

  tile(id: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${id}_0.jpg`;
  }

  delay(i: number, extra = 0): string {
    return `${i * 120 + extra}ms`;
  }

  name(id: string): string {
    return this.t.players().find(p => p.id === id)?.nome ?? '?';
  }

  // ---------- sorteio com animação ----------

  draw(): void {
    const n = this.t.players().length;
    if (n < 10) {
      this.drawMsg.set(`Precisa de 10 jogadores cadastrados (há ${n}).`);
      return;
    }
    if (!this.t.cards().length) {
      this.drawMsg.set('Cadastre ou carregue as cartas.');
      return;
    }
    this.clearTimers();
    const d = this.t.draw();
    if (!d) return;
    this.drawMsg.set(d.card.draft && !this.t.champPool().length ? 'Campeões não carregaram: o draft sai sem campeões.' : '');
    this.stage.set('players');
    this.spinPlayers(d);
  }

  private spinPlayers(d: Draw): void {
    const ids = this.t.players().map(p => p.id);
    const finalIds = [...d.teamA, ...d.teamB];
    const delays = [60, 60, 60, 60, 60, 60, 60, 60, 70, 70, 80, 90, 100, 120, 140, 170, 210, 260, 320];
    let step = 0;
    const tick = () => {
      if (step < delays.length) {
        this.spin.set(shuffle(ids).slice(0, 10));
        this.later(delays[step++], tick);
      } else {
        this.spin.set(finalIds);
        this.later(900, () => this.spinCard(d));
      }
    };
    tick();
  }

  private spinCard(d: Draw): void {
    const pool = this.t.cards();
    const items = Array.from({ length: REEL_LEN }, (_, i) =>
      i === REEL_TARGET ? d.card : pool[(i * 7 + 3) % pool.length]
    );
    this.reelItems.set(items);
    this.reelGo.set(false);
    this.reelX.set(0);
    this.stage.set('card');
    this.later(80, () => {
      this.reelGo.set(true);
      this.reelX.set(-(REEL_TARGET * CARD_STEP + CARD_HALF));
    });
    this.later(3900, () => this.stage.set('teams'));
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  swap(oldId: string, newId: string): void {
    this.t.swapPlayer(oldId, newId);
  }

  save(winner: Winner): void {
    this.clearTimers();
    this.t.saveMatch(winner);
    this.stage.set('idle');
    this.drawMsg.set('');
  }

  // ---------- cadastro ----------

  async addPlayer(nomeEl: HTMLInputElement, riotEl: HTMLInputElement): Promise<void> {
    const riot = riotEl.value.trim();
    this.addMsg.set('');
    if (riot) {
      if (!riot.includes('#')) {
        this.addMsg.set('Riot ID inválido. Use o formato Nome#TAG.');
        return;
      }
      this.addMsg.set('Buscando na Riot…');
      const info = await this.fetchRiot(riot);
      if (!info) {
        this.addMsg.set('Riot ID não encontrado.');
        return;
      }
      this.t.addPlayer(info.nome, info.riotId, info.elo);
    } else {
      this.t.addPlayer(nomeEl.value);
    }
    nomeEl.value = '';
    riotEl.value = '';
    this.addMsg.set('');
    riotEl.focus();
  }

  private async fetchRiot(riotId: string): Promise<{ nome: string; riotId: string; elo: Elo } | null> {
    try {
      const r = await fetch(`/api/elo?riotId=${encodeURIComponent(riotId)}&regiao=${REGIAO}`);
      if (!r.ok) return null;
      const j = await r.json();
      return {
        nome: j.gameName,
        riotId: `${j.gameName}#${j.tagLine}`,
        elo: { tier: j.tier, rank: j.rank, lp: j.lp, vitorias: j.vitorias, derrotas: j.derrotas },
      };
    } catch {
      return null;
    }
  }

  addCard(nome: HTMLInputElement, desc: HTMLInputElement): void {
    this.t.addCard(nome.value, desc.value);
    nome.value = '';
    desc.value = '';
    nome.focus();
  }

  saveNow(): void {
    this.t.saveNow();
    this.savedMsg.set(`Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
  }

  reset(): void {
    if (confirm('Apagar jogadores, cartas e partidas salvos?')) {
      this.clearTimers();
      this.t.reset();
      this.stage.set('idle');
      this.savedMsg.set('');
    }
  }

  eloLabel(e: Elo): string {
    if (!e.tier) return 'Sem ranqueada solo';
    const rank = e.rank ? ` ${e.rank}` : '';
    return `${e.tier}${rank} · ${e.lp ?? 0} PDL · ${e.vitorias}V ${e.derrotas}D`;
  }
}
