import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MapBoard from './MapBoard';
import type { Character } from '../../types';

afterEach(() => cleanup());
Object.defineProperty(window, 'PointerEvent', { writable: true, value: MouseEvent });

function ch(id: string, name: string): Character {
  return { id, name, icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5, maxAmmo: 0, currentAmmo: 0,
    baseInitiative: 0, cardIds: [], conditions: [], items: [] };
}

describe('MapBoard', () => {
  it('renderiza um token por participante presente, com a inicial do nome', () => {
    render(<MapBoard image="" participants={[ch('p1', 'Shinkai'), ch('p2', 'Mikhail')]} tokens={{}} activeId={null} onMoveToken={() => {}} onSelect={() => {}} />);
    expect(screen.getByText(/adicione uma imagem/i)).toBeTruthy();
    expect(screen.getAllByText('S').length).toBeGreaterThan(0);
    expect(screen.getAllByText('M').length).toBeGreaterThan(0);
  });

  it('aplica a posição salva do token', () => {
    render(<MapBoard image="x.png" participants={[ch('p1', 'Shinkai')]} tokens={{ p1: { x: 40, y: 60 } }} activeId="p1" onMoveToken={() => {}} onSelect={() => {}} />);
    const token = screen.getByText('S').closest('[data-token-id]') as HTMLElement;
    expect(token.getAttribute('data-token-id')).toBe('p1');
    expect(token.style.left).toBe('40%');
    expect(token.style.top).toBe('60%');
  });
});

describe('MapBoard combate', () => {
  it('remove os overlays legados durante o combate', () => {
    render(<MapBoard image="x.png" participants={[]} tokens={{}} activeId={null} onMoveToken={() => {}} onSelect={() => {}} combat />);
    expect(screen.queryByText(/camada · combate/i)).toBeNull();
    expect(screen.queryByText(/showtime/i)).toBeNull();
  });

  it('combina no alvo as camadas visuais de cura, dano, condição e reação', () => {
    const { container, rerender } = render(<MapBoard image="x.png" participants={[ch('p1', 'Shinkai')]} tokens={{}} activeId={null} onMoveToken={() => {}} onSelect={() => {}}
      targetEffect={{ id: 'fx-1', targetId: 'p1', kinds: ['heal', 'condition'], hpDelta: 4, result: 'success', conditionName: 'Enraizado', conditionColor: '#22c55e' }} />);
    expect(screen.getByLabelText('Efeito em Shinkai')).toBeTruthy();
    expect(container.querySelector('.is-heal')).toBeTruthy();
    expect(screen.getByText('+4')).toBeTruthy();
    expect(container.querySelector('.cena-target-fx__condition')?.textContent).toContain('Enraizado');

    rerender(<MapBoard image="x.png" participants={[ch('p1', 'Shinkai')]} tokens={{}} activeId={null} onMoveToken={() => {}} onSelect={() => {}}
      targetEffect={{ id: 'fx-2', targetId: 'p1', kinds: ['damage', 'evade'], hpDelta: -6, result: 'failure' }} />);
    expect(container.querySelector('.is-damage')).toBeTruthy();
    expect(screen.getByText('−6')).toBeTruthy();
    expect(container.querySelector('.is-evade')).toBeTruthy();
  });
});

describe('MapBoard — arraste estável', () => {
  it('só persiste a posição ao soltar e não seleciona durante arraste', () => {
    const onMoveToken = vi.fn(); const onSelect = vi.fn();
    const { container } = render(<MapBoard image="" participants={[ch('p1', 'Shinkai')]} tokens={{ p1: { x: 20, y: 20 } }} activeId={null} onMoveToken={onMoveToken} onSelect={onSelect} />);
    const board = container.querySelector('.cena-map-board') as HTMLDivElement;
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    const token = container.querySelector('[data-token-id="p1"]') as HTMLDivElement;
    fireEvent.pointerDown(token, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(token, { pointerId: 1, clientX: 70, clientY: 60 });
    fireEvent.pointerUp(token, { pointerId: 1, clientX: 70, clientY: 60 });
    expect(onMoveToken).toHaveBeenCalledWith('p1', { x: 70, y: 60 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('mantém clique simples como seleção', () => {
    const onMoveToken = vi.fn(); const onSelect = vi.fn();
    const { container } = render(<MapBoard image="" participants={[ch('p1', 'Shinkai')]} tokens={{}} activeId={null} onMoveToken={onMoveToken} onSelect={onSelect} />);
    const board = container.querySelector('.cena-map-board') as HTMLDivElement;
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    const token = container.querySelector('[data-token-id="p1"]') as HTMLDivElement;
    fireEvent.pointerDown(token, { pointerId: 2, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(token, { pointerId: 2, clientX: 20, clientY: 20 });
    expect(onSelect).toHaveBeenCalledWith('p1');
    expect(onMoveToken).not.toHaveBeenCalled();
  });
});

