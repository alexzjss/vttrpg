import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Id } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { setSession } from '../session/session';
import { useGame } from '../store/gameStore';
import { v2Fields } from '../../../../packages/core/src/testing';
import { JogadorPage } from '../pages/JogadorPage';

const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 6 };
const res = (hp: number, hpMax: number) => ({
  hp: { current: hp, max: hpMax },
  aura: { current: 5, max: 5 },
  ammo: { current: 0, max: 0 },
});

/** Mesa com Lia (PJ 15/20), Bran (PJ 8/10) e um Goblin oculto. Devolve os ids e a instância. */
async function campaign() {
  const fake = createFakeTransport();
  await fake.connect({ mode: 'local', actor: { role: 'gm' } });
  const inputs = [
    { kind: 'pc', name: 'Lia', hpVisibility: 'exact', resources: res(15, 20) },
    { kind: 'pc', name: 'Bran', hpVisibility: 'exact', resources: res(8, 10) },
    { kind: 'npc', name: 'Goblin', hpVisibility: 'hidden', resources: res(7, 7) },
  ] as const;
  for (const input of inputs) {
    await fake.send({ type: 'createCharacter', input: { ...base, ...v2Fields(), ...input } });
  }
  const chars = Object.values(fake.authority.getState().characters);
  const idOf = (name: string): Id => chars.find((c) => c.name === name)!.id;
  await fake.send({ type: 'placeToken', characterId: idOf('Lia'), cell: { col: 0, row: 0 } });
  await fake.send({ type: 'placeToken', characterId: idOf('Bran'), cell: { col: 1, row: 0 } });
  await fake.send({ type: 'placeToken', characterId: idOf('Goblin'), cell: { col: 2, row: 0 }, hidden: true });
  const tokenOf = (name: string): Id =>
    Object.values(fake.authority.getState().scene.tokens).find((t) => t.characterId === idOf(name))!.id;
  fake.sent.length = 0;
  return { fake, idOf, tokenOf };
}

async function joinAs(fake: ReturnType<typeof createFakeTransport>, characterId: Id) {
  const session = { mode: 'local', actor: { role: 'player', characterId } } as const;
  setSession(session);
  await useGame.getState().connect(fake, session);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/jogador']}>
      <Routes>
        <Route path="/jogador" element={<JogadorPage />} />
        <Route path="/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JogadorPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    useGame.getState().disconnect();
    vi.restoreAllMocks();
  });

  it('mostra ficha, HP, munição oculta, turno próprio e envia nextTurn', async () => {
    const { fake, idOf, tokenOf } = await campaign();
    await fake.send({
      type: 'startEncounter',
      entries: [
        { tokenId: tokenOf('Lia'), initiative: 20 },
        { tokenId: tokenOf('Bran'), initiative: 10 },
      ],
    });
    fake.sent.length = 0;
    await joinAs(fake, idOf('Lia'));
    renderPage();

    expect(screen.getByRole('heading', { level: 2, name: 'Lia' })).toBeTruthy();
    expect(screen.getByText('15 / 20')).toBeTruthy();
    expect(screen.queryByText('Munição')).toBeNull();
    expect(screen.getByText('Seu turno!')).toBeTruthy();
    expect(screen.getByText('Rodada 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar turno' }));
    await waitFor(() => expect(fake.sent).toEqual([{ type: 'nextTurn' }]));
  });

  it('lista o aliado com retrato, nome e barras exatas', async () => {
    const { fake, idOf } = await campaign();
    await joinAs(fake, idOf('Lia'));
    renderPage();

    expect(screen.getByText('Bran')).toBeTruthy();
    expect(screen.getByText('8 / 10')).toBeTruthy();
  });

  it('turno de um NPC oculto mostra "Turno de alguém oculto"', async () => {
    const { fake, idOf, tokenOf } = await campaign();
    await fake.send({
      type: 'startEncounter',
      entries: [
        { tokenId: tokenOf('Goblin'), initiative: 20 },
        { tokenId: tokenOf('Lia'), initiative: 10 },
      ],
    });
    await joinAs(fake, idOf('Lia'));
    renderPage();

    expect(screen.getByText('Turno de alguém oculto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Encerrar turno' })).toBeNull();
  });

  it('turno de outro PJ mostra o nome dele', async () => {
    const { fake, idOf, tokenOf } = await campaign();
    await fake.send({
      type: 'startEncounter',
      entries: [
        { tokenId: tokenOf('Bran'), initiative: 20 },
        { tokenId: tokenOf('Lia'), initiative: 10 },
      ],
    });
    await joinAs(fake, idOf('Lia'));
    renderPage();

    expect(screen.getByText('Turno de Bran')).toBeTruthy();
  });

  it('fora de combate mostra "Fora de combate"', async () => {
    const { fake, idOf } = await campaign();
    await joinAs(fake, idOf('Lia'));
    renderPage();

    expect(screen.getByText('Fora de combate')).toBeTruthy();
  });

  it('abre a mesa em nova aba', async () => {
    const { fake, idOf } = await campaign();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await joinAs(fake, idOf('Lia'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a mesa' }));
    expect(open).toHaveBeenCalledWith('/mesa', '_blank');
  });

  it('personagem ausente mostra aviso e Sair leva ao login', async () => {
    const { fake } = await campaign();
    await joinAs(fake, 'nao-existe');
    renderPage();

    expect(screen.getByText('Seu personagem não está disponível.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(sessionStorage.getItem('vtt.session')).toBeNull();
  });
});
