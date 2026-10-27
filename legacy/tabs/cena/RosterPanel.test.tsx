import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RosterPanel from './RosterPanel';
import type { Character } from '../../types';
import { getPredefinedEffect } from '../../utils/arsenalEffects';

afterEach(() => cleanup());

function fakeChar(id: string, over: Partial<Character> = {}): Character {
  return { id, name: `N-${id}`, icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5,
    maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [], role: 'npc', ...over };
}

describe('RosterPanel', () => {
  it('lista a party e seleciona um ativo ao clicar', () => {
    const onSelectActive = vi.fn();
    const party = [fakeChar('p1', { role: 'cast', name: 'Doravar' })];
    render(
      <RosterPanel party={party} npcRoster={[]} active={null}
        onSelectActive={onSelectActive} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    fireEvent.click(screen.getByText('Doravar'));
    expect(onSelectActive).toHaveBeenCalledWith({ id: 'p1', side: 'party' });
  });

  it('integra iniciativa e edição rápida na lista de combatentes', () => {
    const onEditCharacter = vi.fn();
    const party = [fakeChar('p1', { role: 'cast', name: 'Doravar' }), fakeChar('p2', { role: 'cast', name: 'Elira' })];
    render(
      <RosterPanel party={party} npcRoster={[]} active={null} round={2}
        orderIds={['p1', 'p2']} currentTurnId="p1" onEditCharacter={onEditCharacter}
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    expect(screen.getByText('RODADA')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('AGORA')).toBeNull();
    expect(screen.queryByText('PRÓXIMO')).toBeNull();
    expect(screen.queryByText('AGUARDA')).toBeNull();
    expect(screen.queryByText('ALIADO')).toBeNull();
    expect(screen.queryByText('HOSTIL')).toBeNull();
    const ring = document.querySelector('.cena-round-clock__ring') as HTMLElement;
    expect(ring.style.background).toContain('#d9b56f');
    // 2 combatentes na ordem, turno atual é o primeiro (índice 0) → 1 gomo aceso, 1 apagado
    expect((ring.style.background.match(/#d9b56f/g) ?? []).length).toBe(1);
    expect((ring.style.background.match(/#3a3f47/g) ?? []).length).toBe(1);
    fireEvent.doubleClick(screen.getByTitle(/doravar.*duplo clique/i));
    expect(onEditCharacter).toHaveBeenCalledWith('p1');
  });
  it('expande apenas o personagem do turno e exibe recursos e condições', () => {
    const party = [
      fakeChar('p1', { role: 'cast', name: 'Doravar', currentHp: 7, currentAura: 3, conditions: [{ name: 'Queimando', duration: 2 }] }),
      fakeChar('p2', { role: 'cast', name: 'Elira', conditions: [{ name: 'Protegida', duration: 1 }] }),
    ];
    const { container } = render(
      <RosterPanel party={party} npcRoster={[]} active={null} round={2}
        orderIds={['p1', 'p2']} currentTurnId="p1"
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );

    expect(container.querySelectorAll('.cena-combatant.is-current')).toHaveLength(1);
    expect(screen.getByLabelText('Vitalidade: 7 de 10')).toBeTruthy();
    expect(screen.getByLabelText('Aura: 3 de 5')).toBeTruthy();
    expect(screen.getByText('CONDIÇÕES & EFEITOS')).toBeTruthy();
    expect(screen.getByText('Queimando')).toBeTruthy();
    expect(screen.queryByText('Protegida')).toBeNull();
  });

  it('mostra Defesa e Stagger como barras no roster e remove a Defesa numerica antiga', () => {
    const party = [fakeChar('p1', {
      role: 'cast',
      name: 'Doravar',
      defense: 12,
      defenseMax: 20,
      defenseCurrent: 0,
      defenseReduction: 0.3,
      defenseRegeneration: 2,
      defenseActivationThreshold: 0.2,
      staggerMax: 100,
      staggerCurrent: 55,
      staggerRecovery: 15,
      staggerDamageMultiplier: 1.4,
      staggerDuration: 1,
      isDefenseBroken: true,
      isStaggered: false,
      staggerTurnsRemaining: 0,
    })];
    const { container } = render(
      <RosterPanel party={party} npcRoster={[]} active={null} round={1}
        orderIds={['p1']} currentTurnId="p1"
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );

    expect(container.querySelector('.cena-vital--defense.is-break')).toBeTruthy();
    expect(container.querySelector('.cena-vital--stagger')).toBeTruthy();
    expect(screen.getByText('BREAK')).toBeTruthy();
    expect(screen.getByText('STAGGER')).toBeTruthy();
    expect(screen.getByText('0/20')).toBeTruthy();
    expect(screen.getByText('55/100')).toBeTruthy();
  });

  it('replica no card o brilho de sucesso ou falha da ação', () => {
    const party = [fakeChar('p1', { role: 'cast', name: 'Doravar' }), fakeChar('p2', { role: 'cast', name: 'Elira' })];
    const { rerender } = render(
      <RosterPanel party={party} npcRoster={[]} active={null} round={1}
        orderIds={['p1', 'p2']} currentTurnId="p1" targetFeedback={{ id: 'fx-success', targetId: 'p2', result: 'success' }}
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    expect(screen.getByLabelText('Sucesso da ação em Elira').classList.contains('is-success')).toBe(true);
    rerender(
      <RosterPanel party={party} npcRoster={[]} active={null} round={1}
        orderIds={['p1', 'p2']} currentTurnId="p1" targetFeedback={{ id: 'fx-failure', targetId: 'p2', result: 'failure' }}
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    expect(screen.getByLabelText('Falha da ação em Elira').classList.contains('is-failure')).toBe(true);
  });

  it('exibe efeitos canônicos ativos no personagem do turno', () => {
    const effect = getPredefinedEffect('Queimadura')!;
    const party = [fakeChar('p1', { role:'cast', name:'Doravar', activeEffects:[{ effect, stacks:1, remaining:2 }] })];
    render(
      <RosterPanel party={party} npcRoster={[]} active={null} round={1}
        orderIds={['p1']} currentTurnId="p1"
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    expect(screen.getByText('Queimadura')).toBeTruthy();
    expect(screen.getByTitle(/Queimadura.*2 rodada/i)).toBeTruthy();
  });

  it('mostra o botão único do dashboard do mestre e dispara onToggleGmDashboard, mesmo fora de combate', () => {
    const onToggleGmDashboard = vi.fn();
    render(
      <RosterPanel party={[]} npcRoster={[]} active={null}
        onToggleGmDashboard={onToggleGmDashboard}
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /abrir dashboard do mestre/i }));
    expect(onToggleGmDashboard).toHaveBeenCalled();
  });

  it('reflete gmDashboardOpen no rótulo/estado do botão', () => {
    render(
      <RosterPanel party={[]} npcRoster={[]} active={null}
        onToggleGmDashboard={() => {}} gmDashboardOpen
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    const btn = screen.getByRole('button', { name: /fechar dashboard do mestre/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('quando pausado, desabilita os botões de turno e mostra a tag PAUSADO', () => {
    const party = [fakeChar('p1', { role: 'cast', name: 'Doravar' })];
    render(
      <RosterPanel party={party} npcRoster={[]} active={null} round={1}
        orderIds={['p1']} currentTurnId="p1" turnControlsDisabled
        onSelectActive={() => {}} onToggleHidden={() => {}}
        onTogglePresent={() => {}} onRemoveNpc={() => {}} />,
    );
    expect(screen.getByText('PAUSADO')).toBeTruthy();
    expect((screen.getByRole('button', { name: /turno anterior/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /próximo turno/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
