import type { LegacyCharacterDraft } from '@vtt/core';
import type { ImageSink } from '../net/imageSink';
import type { Send } from './types';

export interface ImportFailure { name: string; reason: string }
export interface ImportSummary { imported: number; failed: ImportFailure[] }

const IMAGE_KEYS = ['portrait', 'fullBodyArt', 'tokenImage'] as const;

/** Decodifica um data URL em File, mantendo o mime type. */
function dataUrlToFile(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma);
  const mime = meta.split(';')[0] || 'application/octet-stream';
  const body = dataUrl.slice(comma + 1);
  const bytes = meta.includes(';base64')
    ? Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body));
  return new File([bytes], name, { type: mime });
}

/** Troca cada data URL do rascunho pelo resultado do sink; outras strings seguem como estão. */
async function resolveImages(draft: LegacyCharacterDraft, sink: ImageSink): Promise<LegacyCharacterDraft['input']> {
  const input = { ...draft.input };
  const done = new Map<string, string>();
  for (const key of IMAGE_KEYS) {
    const value = input[key];
    if (!value.startsWith('data:')) continue;
    let url = done.get(value);
    if (url === undefined) {
      url = await sink(dataUrlToFile(value, `${draft.legacyId}-${key}`));
      done.set(value, url);
    }
    input[key] = url;
  }
  return input;
}

/** Importa os rascunhos um a um; a falha de um não interrompe os demais. */
export async function importCharacters(
  drafts: LegacyCharacterDraft[],
  opts: { sink: ImageSink; send: Send },
): Promise<ImportSummary> {
  const failed: ImportFailure[] = [];
  let imported = 0;
  for (const draft of drafts) {
    const name = draft.input.name;
    let input: LegacyCharacterDraft['input'];
    try {
      input = await resolveImages(draft, opts.sink);
    } catch {
      failed.push({ name, reason: 'Não foi possível enviar as imagens.' });
      continue;
    }
    try {
      const result = await opts.send({ type: 'createCharacter', input });
      if (result.ok) imported += 1;
      else failed.push({ name, reason: 'O servidor recusou o personagem.' });
    } catch {
      failed.push({ name, reason: 'Falha ao enviar o personagem.' });
    }
  }
  return { imported, failed };
}
