import { defaultResources, type Character, type HpVisibility, type ProjectedCharacter, type ResourceKey } from '@vtt/core';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { readImageFile } from './imageInput';
import type { Send } from './types';

interface Props {
  /** Ausente = criar. Na visão do mestre os recursos nunca são null. */
  character?: ProjectedCharacter;
  send: Send;
  onDone(): void;
}

const MAX_FIELDS: Array<{ key: ResourceKey; label: string }> = [
  { key: 'hp', label: 'HP máximo' },
  { key: 'aura', label: 'Aura máxima' },
  { key: 'ammo', label: 'Munição máxima' },
];
const IMAGE_FIELDS = [
  { key: 'portrait', label: 'Retrato' },
  { key: 'fullBodyArt', label: 'Arte de corpo inteiro' },
  { key: 'tokenImage', label: 'Imagem do token' },
] as const;
type ImageKey = (typeof IMAGE_FIELDS)[number]['key'];

export function CharacterForm({ character, send, onDone }: Props) {
  const initialResources = character?.resources ?? defaultResources();
  const [name, setName] = useState(character?.name ?? '');
  const [kind, setKind] = useState<Character['kind']>(character?.kind ?? 'pc');
  const [speed, setSpeed] = useState(String(character?.speed ?? 5));
  const [hpVisibility, setHpVisibility] = useState<HpVisibility>(character?.hpVisibility ?? 'exact');
  const [images, setImages] = useState<Record<ImageKey, string>>({
    portrait: character?.portrait ?? '',
    fullBodyArt: character?.fullBodyArt ?? '',
    tokenImage: character?.tokenImage ?? '',
  });
  const [maxes, setMaxes] = useState<Record<ResourceKey, string>>({
    hp: String(initialResources.hp.max),
    aura: String(initialResources.aura.max),
    ammo: String(initialResources.ammo.max),
  });
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onImage = (key: ImageKey) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await readImageFile(file);
      setImages((prev) => ({ ...prev, [key]: url }));
      setImageError(null);
    } catch {
      setImageError('Não foi possível ler a imagem.');
    }
  };

  const num = (raw: string) => Math.max(0, Math.trunc(Number(raw)) || 0);
  const effectiveVisibility: HpVisibility = kind === 'pc' ? 'exact' : hpVisibility;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (!character) {
        const resources = defaultResources();
        for (const { key } of MAX_FIELDS) {
          const max = num(maxes[key]);
          resources[key] = { current: max, max };
        }
        const r = await send({
          type: 'createCharacter',
          input: {
            kind, name: trimmed, ...images, speed: num(speed),
            hpVisibility: effectiveVisibility, resources,
          },
        });
        if (r.ok) onDone();
        return;
      }
      const next = { name: trimmed, kind, ...images, speed: num(speed), hpVisibility: effectiveVisibility };
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        if (character[key as keyof typeof next] !== value) patch[key] = value;
      }
      if (Object.keys(patch).length > 0) {
        const r = await send({ type: 'updateCharacter', characterId: character.id, patch });
        if (!r.ok) return;
      }
      for (const { key } of MAX_FIELDS) {
        const max = num(maxes[key]);
        if (max === initialResources[key].max) continue;
        const r = await send({ type: 'setResource', characterId: character.id, resource: key, max });
        if (!r.ok) return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="character-form" onSubmit={(e) => void submit(e)}>
      <h3>{character ? 'Editar personagem' : 'Novo personagem'}</h3>
      <label>
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Tipo
        <select value={kind} onChange={(e) => setKind(e.target.value as Character['kind'])}>
          <option value="pc">Jogador</option>
          <option value="npc">NPC</option>
        </select>
      </label>
      {IMAGE_FIELDS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <input type="file" accept="image/*" onChange={(e) => void onImage(key)(e)} />
          {images[key] && <img className="form-thumb" src={images[key]} alt="" />}
        </label>
      ))}
      {imageError && <p role="alert">{imageError}</p>}
      <label>
        Velocidade
        <input type="number" min={0} value={speed} onChange={(e) => setSpeed(e.target.value)} />
      </label>
      {MAX_FIELDS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <input type="number" min={0} value={maxes[key]}
            onChange={(e) => setMaxes((prev) => ({ ...prev, [key]: e.target.value }))} />
        </label>
      ))}
      {kind === 'npc' && (
        <label>
          Visibilidade de HP
          <select value={hpVisibility} onChange={(e) => setHpVisibility(e.target.value as HpVisibility)}>
            <option value="exact">Exato</option>
            <option value="band">Faixa</option>
            <option value="hidden">Oculto</option>
          </select>
        </label>
      )}
      <div className="form-actions">
        <button type="submit" disabled={!name.trim() || busy}>Salvar</button>
        <button type="button" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}
