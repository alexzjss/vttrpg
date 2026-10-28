import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Command } from '@vtt/core';
import { ImageSinkProvider } from '../net/ImageSinkContext';
import fixtureText from '../../../../packages/core/src/fixtures/legacy-backup.json?raw';
import { ImportPanel } from './ImportPanel';

function setup() {
  const sent: Command[] = [];
  const send = async (c: Command) => { sent.push(c); return { ok: true } as never; };
  render(
    <ImageSinkProvider sink={async () => 'https://cdn.test/x.png'}>
      <ImportPanel send={send} onDone={() => {}} />
    </ImageSinkProvider>,
  );
  const choose = (text: string) =>
    fireEvent.change(screen.getByLabelText(/Arquivo de backup/), {
      target: { files: [new File([text], 'b.json', { type: 'application/json' })] },
    });
  return { sent, choose };
}

describe('ImportPanel', () => {
  it('mostra a prévia e importa só os marcados', async () => {
    const { sent, choose } = setup();
    choose(fixtureText);
    await screen.findByText('Aria Teste');
    expect(screen.getByText('HP 22/30')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Importar Minimo'));
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 personagens' }));
    await screen.findByText('2 importados; 0 falharam');
    expect(sent.map((c) => (c as { input: { name: string } }).input.name)).toEqual(['Aria Teste', 'Goblin Teste']);
  });

  it('trocar o tipo muda o kind enviado', async () => {
    const { sent, choose } = setup();
    choose(fixtureText);
    await screen.findByText('Minimo');
    fireEvent.change(screen.getByLabelText('Tipo de Minimo'), { target: { value: 'npc' } });
    fireEvent.click(screen.getByLabelText('Importar Aria Teste'));
    fireEvent.click(screen.getByLabelText('Importar Goblin Teste'));
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 personagens' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ input: { name: 'Minimo', kind: 'npc' } });
  });

  it('arquivo inválido e versão não suportada mostram erro', async () => {
    const { choose } = setup();
    choose('não é json');
    expect((await screen.findByRole('alert')).textContent).toBe('Arquivo não reconhecido como backup do app antigo.');
    choose(JSON.stringify({ version: 99, characters: [] }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Versão do backup não suportada.'));
  });
});
