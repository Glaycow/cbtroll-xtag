import { Component, computed, inject } from '@angular/core';
import { TournamentService } from './tournament/tournament.service';
import { Match, Role, Winner } from './tournament/tournament.models';

const ROLE_KEY: Record<string, string> = {
  Topo: 'top',
  Selva: 'jungle',
  Meio: 'mid',
  Atirador: 'adc',
  Suporte: 'sup',
};

const ROLE_ICON: Record<string, string> = {
  Topo: '⚔',
  Selva: '🌿',
  Meio: '✦',
  Atirador: '🏹',
  Suporte: '✚',
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly t = inject(TournamentService);

  drawMsg = '';

  readonly bench = computed(() => {
    const d = this.t.current();
    if (!d) return [];
    const used = new Set([...d.teamA, ...d.teamB]);
    return this.t.players().filter(p => !used.has(p.id));
  });

  readonly matchesReversed = computed(() => [...this.t.matches()].reverse());

  readonly leader = computed(() => {
    const s = this.t.standings();
    if (!s.length || !this.t.matches().length) return '—';
    return s[0].player.nome.split(' ')[0];
  });

  readonly coolingIds = computed(() => {
    const last = this.t.matches().slice(-3);
    return new Set(last.map(m => m.card.id));
  });

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

  addPlayer(nome: HTMLInputElement, riot: HTMLInputElement): void {
    this.t.addPlayer(nome.value, riot.value);
    nome.value = '';
    riot.value = '';
    nome.focus();
  }

  addCard(nome: HTMLInputElement, desc: HTMLInputElement): void {
    this.t.addCard(nome.value, desc.value);
    nome.value = '';
    desc.value = '';
    nome.focus();
  }

  draw(): void {
    const n = this.t.players().length;
    if (n < 10) {
      this.drawMsg = `Precisa de 10 jogadores cadastrados (há ${n}).`;
      return;
    }
    if (!this.t.cards().length) {
      this.drawMsg = 'Cadastre ou carregue as cartas.';
      return;
    }
    this.drawMsg = n > 10 ? `Sorteados 10 de ${n} jogadores.` : '';
    this.t.draw();
  }

  swap(oldId: string, newId: string): void {
    this.t.swapPlayer(oldId, newId);
  }

  save(winner: Winner): void {
    this.t.saveMatch(winner);
    this.drawMsg = '';
  }

  name(id: string): string {
    return this.t.players().find(p => p.id === id)?.nome ?? '?';
  }

  teamNames(ids: string[]): string {
    return ids.map(id => this.name(id)).join(' · ');
  }

  winnerLabel(m: Match, side: Winner): string {
    return m.winner === side ? 'venceu' : 'perdeu';
  }
}
