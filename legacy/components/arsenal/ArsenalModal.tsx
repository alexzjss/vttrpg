import React from 'react';
import { X } from 'lucide-react';
import type { Character, Item, Seal } from '../../types';
import type { ArsenalCard, ArsenalEffect, ChargeConfig, CooldownConfig } from '../../utils/arsenal';
import { DatabaseService } from '../../utils/database';
import { useArsenal } from '../../hooks/useArsenal';
import ArsenalWorkspace from './ArsenalWorkspace';

interface ArsenalModalProps {
  characters: Character[];
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
}

type EditState =
  | { kind: 'item'; value: Item }
  | { kind: 'seal'; value: Seal }
  | null;

type QuickEffectKind = 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'modifier' | 'shield' | 'silence' | 'incapacitate' | 'dispel' | 'movement';

const blankItem = (): Item => ({
  id: '',
  name: '',
  description: '',
  image: '',
  category: 'Consumivel',
  quantity: 1,
  maxQuantity: 99,
  usableInCombat: true,
  consumeOnUse: false,
  combatTargeting: 'other',
  combatAreaShape: 'circle',
  usesPerActivation: 1,
  cooldown: { type: 'sem_cooldown' },
  charges: null,
  effects: [],
});

const blankSeal = (): Seal => ({
  id: '',
  name: '',
  description: '',
  image: '',
  code: '',
  symbol: '',
  executionMode: 'immediate',
  executionModes: ['immediate'],
  preparationRounds: 0,
  combatTargeting: 'other',
  directionMode: 'source_to_target',
  range: 1,
  areaSize: 1,
  connectors: ['top', 'right', 'bottom', 'left'],
  ritualKey: '',
  ritualRole: 'condutor',
  rotationAllowed: true,
  maxPerRitual: null,
  connectionTags: [],
  forbiddenConnectionTags: [],
  cooldown: { type: 'sem_cooldown' },
  charges: null,
  effects: [],
});

const ArsenalModal: React.FC<ArsenalModalProps> = ({ characters, onUpdateCharacter }) => {
  const { cards } = useArsenal();
  const [items, setItems] = React.useState<Item[]>([]);
  const [seals, setSeals] = React.useState<Seal[]>([]);
  const [editing, setEditing] = React.useState<EditState>(null);

  React.useEffect(() => DatabaseService.syncItems(setItems), []);
  React.useEffect(() => DatabaseService.syncSeals(setSeals), []);

  const findCard = (id: string, category: ArsenalCard['category']) => cards.find(card => card.id === id && card.category === category);
  const openItem = (id: string) => setEditing({ kind: 'item', value: items.find(item => item.id === id) ?? itemFromCard(findCard(id, 'item')) });
  const openSeal = (id: string) => setEditing({ kind: 'seal', value: seals.find(seal => seal.id === id) ?? sealFromCard(findCard(id, 'selo')) });

  const saveItem = async (item: Item) => {
    const toSave = { ...item, id: item.id || crypto.randomUUID() };
    setItems(prev => prev.some(entry => entry.id === toSave.id) ? prev.map(entry => entry.id === toSave.id ? toSave : entry) : [...prev, toSave]);
    await DatabaseService.saveItem(toSave);
    setEditing(null);
  };

  const saveSeal = async (seal: Seal) => {
    const id = seal.id || crypto.randomUUID();
    const toSave = { ...seal, id, code: seal.code || id.slice(0, 6).toUpperCase() };
    setSeals(prev => prev.some(entry => entry.id === toSave.id) ? prev.map(entry => entry.id === toSave.id ? toSave : entry) : [...prev, toSave]);
    await DatabaseService.saveSeal(toSave);
    setEditing(null);
  };

  return (
    <div style={{ height: '100%', minHeight: 0 }} role="region" aria-label="Arsenal">
      <ArsenalWorkspace
        characters={characters}
        onUpdateCharacter={onUpdateCharacter}
        onCreateItem={() => setEditing({ kind: 'item', value: blankItem() })}
        onEditItem={openItem}
        onCreateSeal={() => setEditing({ kind: 'seal', value: blankSeal() })}
        onEditSeal={openSeal}
      />
      {editing && (
        <EditorShell title={editing.kind === 'item' ? (editing.value.id ? 'Editar item' : 'Novo item') : (editing.value.id ? 'Editar selo' : 'Novo selo')} onClose={() => setEditing(null)}>
          {editing.kind === 'item'
            ? <ItemForm value={editing.value} onSave={saveItem} />
            : <SealForm value={editing.value} onSave={saveSeal} />}
        </EditorShell>
      )}
    </div>
  );
};

function itemFromCard(card?: ArsenalCard): Item {
  if (!card) return blankItem();
  return {
    ...blankItem(),
    id: card.id,
    name: card.name,
    description: card.description,
    image: card.icon,
    quantity: card.item?.quantity ?? 1,
    usableInCombat: true,
    consumeOnUse: card.item?.consumable ?? false,
    combatTargeting: card.target.type === 'proprio_usuario' ? 'self' : card.target.type === 'todos_em_area' ? 'area' : 'other',
    combatDiceRoll: card.testDice ?? undefined,
    combatDamage: card.damage?.flat ?? undefined,
    combatHeal: card.healing?.flat ?? undefined,
    combatAuraCost: card.auraConsumed?.flat ?? undefined,
    combatAuraRecover: card.auraRestored?.flat ?? undefined,
    combatRange: typeof card.metadata?.combatRange === 'number' ? card.metadata.combatRange : card.area?.size,
    combatAreaSize: typeof card.metadata?.combatAreaSize === 'number' ? card.metadata.combatAreaSize : card.area?.size,
    combatAreaShape: typeof card.metadata?.combatAreaShape === 'string' ? card.metadata.combatAreaShape as Item['combatAreaShape'] : card.area?.shape === 'cone' ? 'cone' : card.area?.shape === 'linha' ? 'line' : card.area?.shape === 'quadrado' ? 'square' : 'circle',
    cooldown: card.cooldown,
    charges: card.charges,
    effects: card.effects,
  };
}

function sealFromCard(card?: ArsenalCard): Seal {
  if (!card) return blankSeal();
  return {
    ...blankSeal(),
    id: card.id,
    name: card.name,
    description: card.description,
    image: card.icon,
    code: typeof card.metadata?.legacyCode === 'string' ? card.metadata.legacyCode : card.id.slice(0, 6).toUpperCase(),
    diceRoll: card.testDice ?? undefined,
    damage: card.damage?.flat ?? undefined,
    healHp: card.healing?.flat ?? undefined,
    healAura: card.auraRestored?.flat ?? undefined,
    combatTargeting: card.target.type === 'proprio_usuario' ? 'self' : card.target.type === 'todos_em_area' ? 'area' : 'other',
    directionMode: card.area?.shape === 'linha' ? 'line' : card.area?.shape === 'cone' ? 'cone' : 'source_to_target',
    range: card.area?.size ?? 1,
    areaSize: card.area?.size ?? 1,
    connectors: card.seal?.ritual?.connectors as Seal['connectors'] ?? ['top', 'right', 'bottom', 'left'],
    ritualKey: card.seal?.ritual?.key,
    ritualRole: card.seal?.ritual?.role as Seal['ritualRole'],
    rotationAllowed: card.seal?.ritual?.rotationAllowed,
    maxPerRitual: typeof (card.seal?.ritual as any)?.maxPerRitual === 'number' ? (card.seal?.ritual as any).maxPerRitual : null,
    connectionTags: card.seal?.ritual?.connectionTags,
    forbiddenConnectionTags: card.seal?.ritual?.forbiddenConnectionTags,
    cooldown: card.cooldown,
    charges: card.charges,
    effects: card.effects,
  };
}

function blankEffect(kind: QuickEffectKind): ArsenalEffect {
  const base: ArsenalEffect = {
    id: `effect-${crypto.randomUUID()}`,
    name: 'Novo efeito',
    description: '',
    tags: [],
    duration: { type: 'rodadas', amount: 1 },
    stackBehavior: 'renova_duracao',
    maxStacks: 1,
    triggers: [],
    modifiers: [],
    periodicDamage: null,
    periodicHealing: null,
    auraConsumed: null,
    auraRestored: null,
    attackModifier: 0,
    defenseModifier: 0,
    speedModifier: 0,
    customEffect: null,
  };
  if (kind === 'periodicDamage') return { ...base, name: 'Dano continuo', periodicDamage: { flat: 1 } };
  if (kind === 'periodicHealing') return { ...base, name: 'Regeneracao', periodicHealing: { flat: 1 } };
  if (kind === 'auraRestored') return { ...base, name: 'Recuperar aura', auraRestored: { flat: 1 } };
  if (kind === 'modifier') return { ...base, name: 'Modificador', valueModifiers: [{ target: 'dano', operation: 'somar', value: 1 }] };
  if (kind === 'shield') return { ...base, name: 'Escudo', shield: { flat: 3 } };
  if (kind === 'silence') return { ...base, name: 'Silenciar', silence: { blocksBasicAttack: false } };
  if (kind === 'incapacitate') return { ...base, name: 'Incapacitar', incapacitate: true };
  if (kind === 'dispel') return { ...base, name: 'Dissipar', dispel: { category: 'negativo', count: 1 } };
  return { ...base, name: 'Mover', movement: { kind: 'empurrar', distance: 1 } };
}

function effectKindOf(effect: ArsenalEffect): QuickEffectKind {
  if (effect.periodicDamage) return 'periodicDamage';
  if (effect.periodicHealing) return 'periodicHealing';
  if (effect.auraRestored) return 'auraRestored';
  if (effect.valueModifiers?.length) return 'modifier';
  if (effect.shield) return 'shield';
  if (effect.silence) return 'silence';
  if (effect.incapacitate) return 'incapacitate';
  if (effect.dispel) return 'dispel';
  if (effect.movement) return 'movement';
  return 'modifier';
}

const EditorShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div role="dialog" aria-modal="true" aria-label={title} style={overlay}>
    <div style={panel}>
      <header style={header}><strong>{title}</strong><button onClick={onClose} style={close} aria-label="Fechar"><X size={16}/></button></header>
      {children}
    </div>
  </div>
);

const ItemForm: React.FC<{ value: Item; onSave: (item: Item) => void }> = ({ value, onSave }) => {
  const [form, setForm] = React.useState<Item>(value);
  const [effects, setEffects] = React.useState<ArsenalEffect[]>(value.effects ?? []);
  const set = (patch: Partial<Item>) => setForm(prev => ({ ...prev, ...patch }));
  return <div style={body}>
    <Field label="Nome"><input style={input} value={form.name} onChange={e => set({ name: e.target.value })} /></Field>
    <Field label="Descricao"><textarea style={text} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} /></Field>
    <div style={grid}>
      <Field label="Quantidade"><input type="number" min={0} style={input} value={form.quantity ?? 1} onChange={e => set({ quantity: Number(e.target.value) })} /></Field>
      <Field label="Max estoque"><input type="number" min={0} style={input} value={form.maxQuantity ?? ''} onChange={e => set({ maxQuantity: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Durabilidade"><input type="number" min={0} style={input} value={form.durability ?? ''} onChange={e => set({ durability: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Max durabilidade"><input type="number" min={0} style={input} value={form.maxDurability ?? ''} onChange={e => set({ maxDurability: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Desgaste por uso"><input type="number" min={0} style={input} value={form.wearPerUse ?? ''} onChange={e => set({ wearPerUse: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Usos por ativacao"><input type="number" min={1} style={input} value={form.usesPerActivation ?? 1} onChange={e => set({ usesPerActivation: Number(e.target.value) })} /></Field>
    </div>
    <CombatFields form={form} set={set} damageKey="combatDamage" healKey="combatHeal" auraKey="combatAuraRecover" diceKey="combatDiceRoll" targetKey="combatTargeting" />
    <div style={grid}>
      <Field label="Custo aura"><input type="number" min={0} style={input} value={form.combatAuraCost ?? ''} onChange={e => set({ combatAuraCost: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Alcance"><input type="number" min={0} style={input} value={form.combatRange ?? ''} onChange={e => set({ combatRange: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Area"><input type="number" min={0} style={input} value={form.combatAreaSize ?? ''} onChange={e => set({ combatAreaSize: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      <Field label="Forma area"><select style={input} value={form.combatAreaShape ?? 'circle'} onChange={e => set({ combatAreaShape: e.target.value as Item['combatAreaShape'] })}><option value="circle">Circulo</option><option value="cone">Cone</option><option value="line">Linha</option><option value="square">Quadrado</option></select></Field>
    </div>
    <label style={check}><input type="checkbox" checked={!!form.consumeOnUse} onChange={e => set({ consumeOnUse: e.target.checked })} /> Consumir ao usar</label>
    <CooldownChargesEditor cooldown={form.cooldown} charges={form.charges} onCooldown={cooldown => set({ cooldown })} onCharges={charges => set({ charges })} />
    <AdvancedEffectsEditor effects={effects} onChange={setEffects} />
    <button style={save} disabled={!form.name.trim()} onClick={() => onSave({ ...form, effects })}>Salvar item</button>
  </div>;
};

const SealForm: React.FC<{ value: Seal; onSave: (seal: Seal) => void }> = ({ value, onSave }) => {
  const [form, setForm] = React.useState<Seal>(value);
  const [effects, setEffects] = React.useState<ArsenalEffect[]>(value.effects ?? []);
  const set = (patch: Partial<Seal>) => setForm(prev => ({ ...prev, ...patch }));
  return <div style={body}>
    <div style={grid}><Field label="Nome"><input style={input} value={form.name} onChange={e => set({ name: e.target.value })} /></Field><Field label="Codigo"><input style={input} value={form.code ?? ''} onChange={e => set({ code: e.target.value })} /></Field></div>
    <Field label="Descricao"><textarea style={text} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} /></Field>
    <CombatFields form={form} set={set} damageKey="damage" healKey="healHp" auraKey="healAura" diceKey="diceRoll" targetKey="combatTargeting" />
    <div style={grid}>
      <Field label="Direcao"><select style={input} value={form.directionMode ?? 'source_to_target'} onChange={e => set({ directionMode: e.target.value as Seal['directionMode'] })}><option value="source_to_target">Usuario ate alvo</option><option value="target_to_source">Alvo ate usuario</option><option value="line">Linha</option><option value="cone">Cone</option><option value="around_user">Ao redor</option><option value="free">Livre</option></select></Field>
      <Field label="Alcance"><input type="number" min={0} style={input} value={form.range ?? 1} onChange={e => set({ range: Number(e.target.value) })} /></Field>
      <Field label="Area"><input type="number" min={0} style={input} value={form.areaSize ?? 1} onChange={e => set({ areaSize: Number(e.target.value) })} /></Field>
      <Field label="Preparacao"><input type="number" min={0} style={input} value={form.preparationRounds ?? 0} onChange={e => set({ preparationRounds: Number(e.target.value), executionMode: Number(e.target.value) > 0 ? 'preparation' : 'immediate' })} /></Field>
    </div>
    <RitualDirectionEditor form={form} set={set} />
    <div style={grid}>
      <Field label="Custo HP"><input type="number" min={0} style={input} value={form.cost?.hp ?? ''} onChange={e => set({ cost: { ...(form.cost ?? {}), hp: e.target.value === '' ? undefined : Number(e.target.value) } })} /></Field>
      <Field label="Custo aura"><input type="number" min={0} style={input} value={form.cost?.aura ?? ''} onChange={e => set({ cost: { ...(form.cost ?? {}), aura: e.target.value === '' ? undefined : Number(e.target.value) } })} /></Field>
      <Field label="Custo municao"><input type="number" min={0} style={input} value={form.cost?.ammo ?? ''} onChange={e => set({ cost: { ...(form.cost ?? {}), ammo: e.target.value === '' ? undefined : Number(e.target.value) } })} /></Field>
    </div>
    <CooldownChargesEditor cooldown={form.cooldown} charges={form.charges} onCooldown={cooldown => set({ cooldown })} onCharges={charges => set({ charges })} />
    <AdvancedEffectsEditor effects={effects} onChange={setEffects} />
    <button style={save} disabled={!form.name.trim()} onClick={() => onSave({ ...form, effects })}>Salvar selo</button>
  </div>;
};

const CombatFields = ({ form, set, damageKey, healKey, auraKey, diceKey, targetKey }: any) => <div style={grid}>
  <Field label="Alvo"><select style={input} value={form[targetKey] ?? 'other'} onChange={e => set({ [targetKey]: e.target.value })}><option value="other">Outro</option><option value="self">Proprio usuario</option><option value="area">Area</option><option value="choice">Escolha</option></select></Field>
  <Field label="Teste"><input style={input} value={form[diceKey] ?? ''} onChange={e => set({ [diceKey]: e.target.value })} placeholder="1d20+3" /></Field>
  <Field label="Dano"><input type="number" style={input} value={form[damageKey] ?? ''} onChange={e => set({ [damageKey]: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
  <Field label="Cura"><input type="number" style={input} value={form[healKey] ?? ''} onChange={e => set({ [healKey]: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
  <Field label="Aura"><input type="number" style={input} value={form[auraKey] ?? ''} onChange={e => set({ [auraKey]: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
</div>;

const CONNECTORS: Array<NonNullable<Seal['connectors']>[number]> = ['topLeft', 'top', 'topRight', 'left', 'right', 'bottomLeft', 'bottom', 'bottomRight'];
const CONNECTOR_LABEL: Record<NonNullable<Seal['connectors']>[number], string> = {
  top: 'N', right: 'L', bottom: 'S', left: 'O',
  topLeft: 'NO', topRight: 'NE', bottomLeft: 'SO', bottomRight: 'SE',
};

const RitualDirectionEditor: React.FC<{ form: Seal; set: (patch: Partial<Seal>) => void }> = ({ form, set }) => {
  const connectors = form.connectors ?? [];
  const toggle = (connector: NonNullable<Seal['connectors']>[number]) => {
    set({ connectors: connectors.includes(connector) ? connectors.filter(item => item !== connector) : [...connectors, connector] });
  };
  const setCsv = (key: 'connectionTags' | 'forbiddenConnectionTags', value: string) =>
    set({ [key]: value.split(',').map(tag => tag.trim()).filter(Boolean) } as Partial<Seal>);
  return <section style={sectionBox}>
    <div style={rowBetween}>
      <strong style={sectionTitle}>Direcao ritualistica</strong>
      <label style={check}><input type="checkbox" checked={form.rotationAllowed ?? true} onChange={e => set({ rotationAllowed: e.target.checked })} /> Permitir giro no visualizador</label>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'150px 1fr', gap:12, alignItems:'center' }}>
      <div style={connectorPad} aria-label="Conectores do selo">
        {CONNECTORS.map(connector => <button
          key={connector}
          type="button"
          onClick={() => toggle(connector)}
          title={connector}
          style={{
            ...connectorButton,
            gridArea: connector,
            borderColor: connectors.includes(connector) ? '#7dd3fc' : '#334155',
            color: connectors.includes(connector) ? '#e0f2fe' : '#64748b',
            background: connectors.includes(connector) ? 'rgba(14,165,233,.22)' : '#0b0e14',
          }}
        >{CONNECTOR_LABEL[connector]}</button>)}
        <div style={connectorCenter}>SELO</div>
      </div>
      <div style={grid}>
        <Field label="Chave ritual"><input style={input} value={form.ritualKey ?? ''} onChange={e => set({ ritualKey: e.target.value })} placeholder="ex: selo-vento" /></Field>
        <Field label="Papel"><select style={input} value={form.ritualRole ?? 'condutor'} onChange={e => set({ ritualRole: e.target.value as Seal['ritualRole'] })}><option value="nucleo">Nucleo</option><option value="condutor">Condutor</option><option value="amplificador">Amplificador</option><option value="estabilizador">Estabilizador</option><option value="material">Material</option></select></Field>
        <Field label="Max por ritual"><input type="number" min={0} style={input} value={form.maxPerRitual ?? ''} onChange={e => set({ maxPerRitual: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Tags que oferece"><input style={input} value={(form.connectionTags ?? []).join(', ')} onChange={e => setCsv('connectionTags', e.target.value)} placeholder="fogo, amplifica" /></Field>
        <Field label="Tags proibidas"><input style={input} value={(form.forbiddenConnectionTags ?? []).join(', ')} onChange={e => setCsv('forbiddenConnectionTags', e.target.value)} placeholder="agua, instavel" /></Field>
      </div>
    </div>
  </section>;
};

const CooldownChargesEditor: React.FC<{ cooldown?: CooldownConfig; charges?: ChargeConfig | null; onCooldown: (cooldown: CooldownConfig) => void; onCharges: (charges: ChargeConfig | null) => void }> = ({ cooldown, charges, onCooldown, onCharges }) => {
  const cd = cooldown ?? { type: 'sem_cooldown' as const };
  const updateCharge = (patch: Partial<ChargeConfig>) => onCharges({ maximum: 1, current: 1, recharge: { type: 'nao_recarrega' }, ...(charges ?? {}), ...patch });
  return <section style={sectionBox}>
    <strong style={sectionTitle}>Ritmo de uso</strong>
    <div style={grid}>
      <Field label="Cooldown"><select style={input} value={cd.type} onChange={event => {
        const type = event.target.value as CooldownConfig['type'];
        onCooldown(type === 'sem_cooldown' ? { type } : type === 'fim_combate' || type === 'descanso' ? { type } : type === 'gatilho' ? { type, trigger: 'uso_manual' } : { type, amount: 1 } as CooldownConfig);
      }}><option value="sem_cooldown">Sem cooldown</option><option value="turnos">Turnos</option><option value="rodadas">Rodadas</option><option value="usos">Usos</option><option value="fim_combate">Ate fim do combate</option><option value="descanso">Ate descanso</option></select></Field>
      {'amount' in cd && <Field label="Tempo"><input style={input} type="number" min={1} value={cd.amount} onChange={event => onCooldown({ ...cd, amount: Number(event.target.value) || 1 } as CooldownConfig)} /></Field>}
      <Field label="Cargas"><select style={input} value={charges ? 'sim' : 'nao'} onChange={event => onCharges(event.target.value === 'sim' ? { maximum: 3, current: 3, recharge: { type: 'por_rodada', amount: 1 } } : null)}><option value="nao">Sem cargas</option><option value="sim">Usa cargas</option></select></Field>
      {charges && <><Field label="Atual"><input style={input} type="number" min={0} value={charges.current} onChange={event => updateCharge({ current: Number(event.target.value) || 0 })} /></Field><Field label="Max"><input style={input} type="number" min={1} value={charges.maximum} onChange={event => updateCharge({ maximum: Number(event.target.value) || 1 })} /></Field><Field label="Recarga"><select style={input} value={charges.recharge.type} onChange={event => updateCharge({ recharge: event.target.value === 'nao_recarrega' ? { type: 'nao_recarrega' } : { type: event.target.value as any, amount: 1 } })}><option value="nao_recarrega">Nao recarrega</option><option value="por_turno">Por turno</option><option value="por_rodada">Por rodada</option><option value="automatica">Automatica</option></select></Field>{'amount' in charges.recharge && <Field label="Qtd recarga"><input style={input} type="number" min={1} value={charges.recharge.amount} onChange={event => updateCharge({ recharge: { ...charges.recharge, amount: Number(event.target.value) || 1 } as ChargeConfig['recharge'] })} /></Field>}</>}
    </div>
  </section>;
};

const AdvancedEffectsEditor: React.FC<{ effects: ArsenalEffect[]; onChange: (effects: ArsenalEffect[]) => void }> = ({ effects, onChange }) => {
  const patch = (index: number, update: Partial<ArsenalEffect>) => onChange(effects.map((effect, i) => i === index ? { ...effect, ...update } : effect));
  const patchAmount = (index: number, key: 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'shield', field: 'flat' | 'dice', value: string) => {
    const current = effects[index][key] ?? { flat: 0 };
    patch(index, { [key]: { ...current, [field]: field === 'flat' ? Number(value) || 0 : value || undefined } } as Partial<ArsenalEffect>);
  };
  const patchModifier = (index: number, field: 'target' | 'operation' | 'value' | 'dice', value: string) => {
    const current = effects[index].valueModifiers?.[0] ?? { target: 'dano' as const, operation: 'somar' as const, value: 1 };
    patch(index, { valueModifiers: [{ ...current, [field]: field === 'value' ? Number(value) || 0 : value || undefined }] as ArsenalEffect['valueModifiers'] });
  };
  return <section style={sectionBox}>
    <div style={rowBetween}>
      <strong style={sectionTitle}>Efeitos avancados</strong>
      <select style={{ ...input, width: 190 }} value="" onChange={event => {
        if (!event.target.value) return;
        onChange([...effects, blankEffect(event.target.value as QuickEffectKind)]);
        event.currentTarget.value = '';
      }}>
        <option value="">Adicionar efeito</option>
        <option value="periodicDamage">Dano continuo</option>
        <option value="periodicHealing">Regeneracao</option>
        <option value="auraRestored">Recuperar aura</option>
        <option value="modifier">Modificar valores</option>
        <option value="shield">Escudo</option>
        <option value="silence">Silenciar</option>
        <option value="incapacitate">Incapacitar</option>
        <option value="dispel">Dissipar</option>
        <option value="movement">Movimento</option>
      </select>
    </div>
    {effects.length === 0 && <p style={muted}>Nenhum efeito configurado.</p>}
    {effects.map((effect, index) => {
      const kind = effectKindOf(effect);
      const amountKey = (['periodicDamage', 'periodicHealing', 'auraRestored', 'shield'] as QuickEffectKind[]).includes(kind) ? kind as 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'shield' : null;
      return <div key={effect.id || index} style={effectCard}>
        <div style={{ ...grid, gridTemplateColumns: '1fr 110px 34px' }}>
          <input style={input} value={effect.name} onChange={event => patch(index, { name: event.target.value })} placeholder="Nome do efeito" />
          <input style={input} type="number" min={0} value={effect.duration.amount ?? 1} onChange={event => patch(index, { duration: { ...effect.duration, type: 'rodadas', amount: Number(event.target.value) || 0 } })} title="Duracao em rodadas" />
          <button style={dangerButton} onClick={() => onChange(effects.filter((_, i) => i !== index))} aria-label="Remover efeito">x</button>
        </div>
        <textarea style={{ ...text, minHeight: 46 }} value={effect.description ?? ''} onChange={event => patch(index, { description: event.target.value })} placeholder="Descricao mecanica curta" />
        {amountKey && <div style={grid}>
          <Field label="Valor fixo"><input style={input} type="number" value={(effect[amountKey] as any)?.flat ?? 0} onChange={event => patchAmount(index, amountKey, 'flat', event.target.value)} /></Field>
          <Field label="Dado extra"><input style={input} value={(effect[amountKey] as any)?.dice ?? ''} onChange={event => patchAmount(index, amountKey, 'dice', event.target.value)} placeholder="1d6" /></Field>
        </div>}
        {kind === 'modifier' && <div style={grid}>
          <Field label="Altera"><select style={input} value={effect.valueModifiers?.[0]?.target ?? 'dano'} onChange={event => patchModifier(index, 'target', event.target.value)}><option value="teste">Teste</option><option value="dano">Dano</option><option value="cura">Cura</option><option value="custo_aura">Custo de aura</option><option value="cooldown">Cooldown</option><option value="defesa">Defesa</option><option value="velocidade">Velocidade</option><option value="vida_maxima">Vida maxima</option><option value="aura_maxima">Aura maxima</option></select></Field>
          <Field label="Operacao"><select style={input} value={effect.valueModifiers?.[0]?.operation ?? 'somar'} onChange={event => patchModifier(index, 'operation', event.target.value)}><option value="somar">Somar</option><option value="subtrair">Subtrair</option><option value="multiplicar">Multiplicar</option><option value="dividir">Dividir</option><option value="adicionar_dado">Adicionar dado</option><option value="vantagem">Vantagem</option><option value="desvantagem">Desvantagem</option><option value="definir_minimo">Minimo</option><option value="definir_maximo">Maximo</option></select></Field>
          <Field label="Valor"><input style={input} type="number" value={effect.valueModifiers?.[0]?.value ?? 0} onChange={event => patchModifier(index, 'value', event.target.value)} /></Field>
          <Field label="Dado"><input style={input} value={effect.valueModifiers?.[0]?.dice ?? ''} onChange={event => patchModifier(index, 'dice', event.target.value)} placeholder="1d4" /></Field>
        </div>}
        {kind === 'silence' && <label style={check}><input type="checkbox" checked={!!effect.silence?.blocksBasicAttack} onChange={event => patch(index, { silence: { blocksBasicAttack: event.target.checked } })} /> Bloqueia ataque basico</label>}
        {kind === 'dispel' && <div style={grid}><Field label="Categoria"><select style={input} value={effect.dispel?.category ?? 'negativo'} onChange={event => patch(index, { dispel: { category: event.target.value as any, count: effect.dispel?.count ?? 1 } })}><option value="positivo">Positivo</option><option value="negativo">Negativo</option><option value="qualquer">Qualquer</option></select></Field><Field label="Quantidade"><input style={input} type="number" min={1} value={effect.dispel?.count ?? 1} onChange={event => patch(index, { dispel: { category: effect.dispel?.category ?? 'negativo', count: Number(event.target.value) || 1 } })} /></Field></div>}
        {kind === 'movement' && <div style={grid}><Field label="Movimento"><select style={input} value={effect.movement?.kind ?? 'empurrar'} onChange={event => patch(index, { movement: { kind: event.target.value as any, distance: effect.movement?.distance ?? 1 } })}><option value="empurrar">Empurrar</option><option value="puxar">Puxar</option><option value="teleportar">Teleportar</option><option value="trocar_lugar">Trocar lugar</option></select></Field><Field label="Distancia"><input style={input} type="number" min={0} value={effect.movement?.distance ?? 1} onChange={event => patch(index, { movement: { kind: effect.movement?.kind ?? 'empurrar', distance: Number(event.target.value) || 0 } })} /></Field></div>}
      </div>;
    })}
  </section>;
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label style={{ display:'grid', gap:5, minWidth:0 }}><span style={labelStyle}>{label}</span>{children}</label>;

const overlay: React.CSSProperties = { position:'fixed', inset:0, zIndex:100000, display:'grid', placeItems:'center', padding:24, background:'rgba(0,0,0,.72)', backdropFilter:'blur(8px)' };
const panel: React.CSSProperties = { width:'min(860px, 96vw)', maxHeight:'90vh', overflow:'hidden', border:'1px solid #3a4351', borderRadius:10, background:'#10131a', boxShadow:'0 24px 80px rgba(0,0,0,.55)' };
const header: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.08)', color:'#f4f6f8', textTransform:'uppercase', letterSpacing:'.08em', fontSize:12 };
const close: React.CSSProperties = { display:'grid', placeItems:'center', width:30, height:30, border:'1px solid #3b4350', borderRadius:6, background:'#171c24', color:'#d9dee7', cursor:'pointer' };
const body: React.CSSProperties = { display:'grid', gap:12, padding:16, maxHeight:'calc(90vh - 60px)', overflowY:'auto' };
const grid: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 };
const rowBetween: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' };
const sectionBox: React.CSSProperties = { display:'grid', gap:10, padding:12, border:'1px solid #29313d', borderRadius:9, background:'#0b0e14' };
const sectionTitle: React.CSSProperties = { color:'#d9b76e', fontSize:10, fontWeight:900, letterSpacing:'.12em', textTransform:'uppercase' };
const effectCard: React.CSSProperties = { display:'grid', gap:8, padding:10, border:'1px solid #343c49', borderRadius:8, background:'#111722' };
const connectorPad: React.CSSProperties = {
  display:'grid',
  gridTemplateAreas:'"topLeft top topRight" "left center right" "bottomLeft bottom bottomRight"',
  gridTemplateColumns:'42px 42px 42px',
  gridTemplateRows:'42px 42px 42px',
  gap:6,
  justifyContent:'center',
};
const connectorButton: React.CSSProperties = { border:'1px solid #334155', borderRadius:7, fontSize:10, fontWeight:900, cursor:'pointer' };
const connectorCenter: React.CSSProperties = { gridArea:'center', display:'grid', placeItems:'center', border:'1px solid #4b5563', borderRadius:9, color:'#d9b76e', background:'#151922', fontSize:10, fontWeight:900 };
const labelStyle: React.CSSProperties = { fontSize:9, color:'#87909e', fontWeight:900, letterSpacing:'.1em', textTransform:'uppercase' };
const input: React.CSSProperties = { width:'100%', boxSizing:'border-box', padding:'9px 10px', border:'1px solid #343c49', borderRadius:7, background:'#090b10', color:'#eef1f5' };
const text: React.CSSProperties = { ...input, minHeight:74, resize:'vertical' };
const check: React.CSSProperties = { display:'flex', alignItems:'center', gap:8, color:'#cbd2dc', fontSize:12 };
const muted: React.CSSProperties = { margin:0, color:'#6f7886', fontSize:11 };
const dangerButton: React.CSSProperties = { display:'grid', placeItems:'center', border:'1px solid #7f1d1d', borderRadius:7, background:'#2a0d12', color:'#fecdd3', cursor:'pointer' };
const save: React.CSSProperties = { justifySelf:'end', padding:'10px 16px', border:'1px solid #d4a72c', borderRadius:8, background:'#a67b22', color:'#110d05', fontSize:11, fontWeight:900, textTransform:'uppercase', cursor:'pointer' };

export default ArsenalModal;
