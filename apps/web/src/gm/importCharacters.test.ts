import { describe, expect, it, vi } from 'vitest';
import { parseLegacyBackup, type Command } from '@vtt/core';
import fixture from '../../../../packages/core/src/fixtures/legacy-backup.json';
import { importCharacters } from './importCharacters';

const drafts = () => {
  const r = parseLegacyBackup(fixture);
  if (!r.ok) throw new Error('fixture');
  return r.characters;
};

describe('importCharacters', () => {
  it('troca as data URLs pelas URLs do sink e mantém URLs http', async () => {
    const sink = vi.fn(async (f: File) => `https://cdn.test/${f.type}/${f.name}`);
    const sent: Command[] = [];
    const send = async (c: Command) => { sent.push(c); return { ok: true } as never; };
    const r = await importCharacters(drafts(), { sink, send });
    expect(r).toEqual({ imported: 3, failed: [] });
    const aria = sent[0] as Extract<Command, { type: 'createCharacter' }>;
    expect(aria.input.portrait).toBe('https://cdn.test/image/png/leg-1-portrait');
    expect(aria.input.tokenImage).toBe(aria.input.portrait);
    expect(aria.input.fullBodyArt).toBe('https://cdn.test/image/png/leg-1-fullBodyArt');
    expect(sink).toHaveBeenCalledTimes(2);
    const goblin = sent[2] as Extract<Command, { type: 'createCharacter' }>;
    expect(goblin.input.portrait).toBe('https://example.test/goblin.png');
    expect(JSON.stringify(sent)).not.toContain('data:');
  });

  it('imagem que falha conta como failed e o resto segue', async () => {
    const sink = vi.fn(async () => { throw new Error('boom'); });
    const send = vi.fn(async () => ({ ok: true }) as never);
    const r = await importCharacters(drafts(), { sink, send });
    expect(r.imported).toBe(2);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].name).toBe('Aria Teste');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('rejeição do send e resultado não-ok contam como falha', async () => {
    const sink = vi.fn(async () => 'u');
    let n = 0;
    const send = async () => {
      n += 1;
      if (n === 1) throw new Error('net');
      if (n === 2) return { ok: false, error: 'x' } as never;
      return { ok: true } as never;
    };
    const r = await importCharacters(drafts(), { sink, send });
    expect(r.imported).toBe(1);
    expect(r.failed.map((f) => f.name)).toEqual(['Aria Teste', 'Minimo']);
  });
});
