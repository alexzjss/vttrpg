import React from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Edit3, Plus, Search, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import type { Card, Character, Seal, Weapon } from '../../types';
import type { NpcEntry } from '../../utils/cena';
import type { ArsenalCard } from '../../utils/arsenal';
import CharacterEditor from './CharacterEditor';

const INITIAL_CAST_ITEMS = 48;
const LOAD_MORE_CAST_ITEMS = 48;

export interface CharacterManagerModalProps {
  characters: Character[];
  npcRoster: NpcEntry[];
  benchedCastIds: string[];
  cards: Card[];
  weapons: Weapon[];
  seals: Seal[];
  arsenalCards: ArsenalCard[];
  onToggleBench: (id: string) => void;
  onSpawnNpc: (char: Character) => void;
  onEditNpc: (npcId: string, updates: Partial<Character>) => void;
  onRemoveNpc: (npcId: string) => void;
  onSaveCharacter: (char: Character) => void;
  onDeleteCharacter: (id: string) => void;
  onExportCharacter: (char: Character) => void;
}

function EditorFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4 anim-fade" style={{ background: 'rgba(8,10,14,0.88)', backdropFilter: 'blur(20px)' }}>
      <div className="border rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scroll shadow-[0_30px_100px_rgba(0,0,0,0.8)] anim-scale-in" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-gold)' }}>
        <div className="flex justify-between items-center p-7 pb-5 border-b sticky top-0 rounded-t-[2rem] z-10" style={{ background: 'rgba(22,27,38,0.97)', borderColor: 'var(--border-gold)', backdropFilter: 'blur(8px)' }}>
          <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-rose-600/20 hover:text-rose-400 transition-all" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-faint)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-7 pt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const CastCard: React.FC<{
  char: Character;
  idx: number;
  inScene: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onToggleScene: () => void;
  onSpawnNpc: () => void;
}> = React.memo(({ char, idx, inScene, onEdit, onDelete, onExport, onToggleScene, onSpawnNpc }) => {
  const accentColor = '#5a9ae8';
  return (
    <div className={`mp-character-banner ${idx < 24 ? 'anim-fade-up' : ''}`} style={{ animationDelay: `${Math.min(idx, 8) * 24}ms`, '--char-accent': accentColor, contentVisibility:'auto', containIntrinsicSize:'220px' } as React.CSSProperties}>
      <div className="mp-character-portrait">
        {char.icon
          ? <img src={char.icon} alt={char.name} />
          : <div className="mp-character-portrait__fallback"><Users style={{ width: 52, height: 52, color: accentColor, opacity: 0.45 }} /></div>}
        <div className="mp-character-portrait__veil" />
        <div className="mp-character-portrait__glow" />
        <div className="mp-character-portrait__badge">PERSONAGEM</div>
        {inScene && <div className="mp-character-portrait__combat"><Users style={{ width: 9, height: 9 }} /> Na cena</div>}
      </div>
      <div className="mp-character-body">
        <div className="mp-character-name">{char.name}</div>
        {char.code && <div className="mp-character-meta">#{char.code}</div>}
        <div className="mp-character-stat-strip">
          <div className="mp-character-stat"><span className="mp-character-stat__label">❤ HP</span><span className="mp-character-stat__value" style={{ '--stat-color': '#4ad08a' } as React.CSSProperties}>{char.maxHp}</span></div>
          <div className="mp-character-stat"><span className="mp-character-stat__label">⚡ Aura</span><span className="mp-character-stat__value" style={{ '--stat-color': '#5a9ae8' } as React.CSSProperties}>{char.maxAura}</span></div>
          {char.maxAmmo > 0 && <div className="mp-character-stat"><span className="mp-character-stat__label">🎯 Mun.</span><span className="mp-character-stat__value" style={{ '--stat-color': '#7fe0ff' } as React.CSSProperties}>{char.maxAmmo}</span></div>}
        </div>
        <div className="mp-character-actions">
          <button onClick={onExport} className="mp-character-action-btn" title="Exportar personagem e cartas" aria-label={`Exportar ${char.name}`}><Download /></button>
          <button onClick={onEdit} className="mp-character-action-btn mp-character-action-btn--edit" title="Editar"><Edit3 /></button>
          <button onClick={onToggleScene} className="mp-character-action-btn mp-character-action-btn--combat" title={inScene ? 'Remover da cena' : 'Adicionar à cena'} aria-label={inScene ? `Remover ${char.name} da cena` : `Adicionar ${char.name} à cena`}>
            {inScene ? <UserMinus /> : <UserPlus />}
          </button>
          <button onClick={onSpawnNpc} className="mp-character-action-btn mp-character-action-btn--combat" title="Adicionar cópia à cena como NPC" aria-label={`Adicionar cópia de ${char.name} como NPC`}><Copy /></button>
          <button onClick={onDelete} className="mp-character-action-btn mp-character-action-btn--delete" title="Excluir"><Trash2 /></button>
        </div>
      </div>
    </div>
  );
});

const NpcCard: React.FC<{ char: NpcEntry; idx: number; onEdit: () => void; onRemove: () => void }> = React.memo(({ char, idx, onEdit, onRemove }) => {
  const accentColor = '#e0102b';
  return (
    <div className={`mp-character-banner ${idx < 24 ? 'anim-fade-up' : ''}`} style={{ animationDelay: `${Math.min(idx, 8) * 24}ms`, '--char-accent': accentColor, contentVisibility:'auto', containIntrinsicSize:'220px' } as React.CSSProperties}>
      <div className="mp-character-portrait">
        {char.icon
          ? <img src={char.icon} alt={char.name} />
          : <div className="mp-character-portrait__fallback"><Users style={{ width: 52, height: 52, color: accentColor, opacity: 0.45 }} /></div>}
        <div className="mp-character-portrait__veil" />
        <div className="mp-character-portrait__glow" />
        <div className="mp-character-portrait__badge">NPC DE CENA</div>
      </div>
      <div className="mp-character-body">
        <div className="mp-character-name">{char.name}</div>
        <div className="mp-character-stat-strip">
          <div className="mp-character-stat"><span className="mp-character-stat__label">❤ HP</span><span className="mp-character-stat__value" style={{ '--stat-color': '#4ad08a' } as React.CSSProperties}>{char.maxHp}</span></div>
          <div className="mp-character-stat"><span className="mp-character-stat__label">⚡ Aura</span><span className="mp-character-stat__value" style={{ '--stat-color': '#5a9ae8' } as React.CSSProperties}>{char.maxAura}</span></div>
        </div>
        <div className="mp-character-actions">
          <button onClick={onEdit} className="mp-character-action-btn mp-character-action-btn--edit" title="Editar"><Edit3 /></button>
          <button onClick={onRemove} className="mp-character-action-btn mp-character-action-btn--delete" title="Remover da cena" aria-label={`Remover ${char.name} da cena`}><Trash2 /></button>
        </div>
      </div>
    </div>
  );
});

const CharacterManagerModal: React.FC<CharacterManagerModalProps> = ({
  characters, npcRoster, benchedCastIds, cards, weapons, seals, arsenalCards,
  onToggleBench, onSpawnNpc, onEditNpc, onRemoveNpc, onSaveCharacter, onDeleteCharacter, onExportCharacter,
}) => {
  const [search, setSearch] = React.useState('');
  const [editingChar, setEditingChar] = React.useState<Character | 'new' | null>(null);
  const [editingNpcId, setEditingNpcId] = React.useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = React.useState(INITIAL_CAST_ITEMS);

  const deferredSearch = React.useDeferredValue(search);
  const q = deferredSearch.trim().toLocaleLowerCase('pt-BR');
  const sceneIds = React.useMemo(()=>new Set(benchedCastIds),[benchedCastIds]);
  const filteredCharacters = React.useMemo(() => characters.filter(c => !q || `${c.name} ${c.code??''}`.toLocaleLowerCase('pt-BR').includes(q)), [characters, q]);
  const filteredNpcs = React.useMemo(() => npcRoster.filter(n => !q || n.name.toLocaleLowerCase('pt-BR').includes(q)), [npcRoster, q]);
  React.useEffect(()=>setVisibleLimit(INITIAL_CAST_ITEMS),[q]);
  const totalFiltered = filteredCharacters.length + filteredNpcs.length;
  const visibleCharacters = filteredCharacters.slice(0, visibleLimit);
  const npcLimit = Math.max(0, visibleLimit - visibleCharacters.length);
  const visibleNpcs = filteredNpcs.slice(0, npcLimit);
  const shownTotal = visibleCharacters.length + visibleNpcs.length;
  const canShowMore = shownTotal < totalFiltered;

  const editingNpc = editingNpcId ? npcRoster.find(n => n.id === editingNpcId) ?? null : null;

  return (
    <>
      <div role="region" aria-label="Elenco da cena" style={{ padding: '22px clamp(16px,3vw,40px)', boxSizing: 'border-box', height: '100%', overflow: 'auto' }}>
          <section className="cena-gm-modal__section" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#8b93a0' }} />
                <input aria-label="Buscar personagem" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                  style={{ width: '100%', padding: '9px 10px 9px 32px', background: '#171724', border: '1px solid #423c52', color: '#eee', borderRadius: 6, boxSizing: 'border-box' }} />
              </label>
              <button onClick={() => setEditingChar('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', color: '#e9daee', background: '#272236', border: '1px solid #6d5a79', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.5px' }}>
                <Plus size={14} /> Novo personagem
              </button>
            </div>
          </section>

          <section className="cena-gm-modal__section" style={{ overflow: 'auto', paddingLeft: 0, paddingRight: 0 }}>
            <div className="mp-character-grid">
              {visibleCharacters.map((char, idx) => (
                <CastCard key={char.id} char={char} idx={idx}
                  inScene={!sceneIds.has(char.id)}
                  onEdit={() => setEditingChar(char)}
                  onDelete={() => onDeleteCharacter(char.id)}
                  onExport={() => onExportCharacter(char)}
                  onToggleScene={() => onToggleBench(char.id)}
                  onSpawnNpc={() => onSpawnNpc(char)}
                />
              ))}
              {visibleNpcs.map((npc, idx) => (
                <NpcCard key={npc.id} char={npc} idx={visibleCharacters.length + idx}
                  onEdit={() => setEditingNpcId(npc.id)}
                  onRemove={() => onRemoveNpc(npc.id)}
                />
              ))}
              {filteredCharacters.length === 0 && filteredNpcs.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#8b93a0' }}>
                  Nenhum personagem encontrado. Clique em <em>Novo personagem</em> para criar o primeiro.
                </div>
              )}
              {canShowMore && (
                <div style={{ gridColumn:'1/-1', display:'grid', placeItems:'center', padding:'8px 0 4px' }}>
                  <button onClick={() => setVisibleLimit(limit => limit + LOAD_MORE_CAST_ITEMS)} style={loadMoreButton}>
                    Mostrar mais {Math.min(LOAD_MORE_CAST_ITEMS, totalFiltered - shownTotal)} de {totalFiltered}
                  </button>
                </div>
              )}
            </div>
          </section>
      </div>

      {editingChar && (
        <EditorFrame title={editingChar === 'new' ? 'Criar Personagem' : 'Editar Personagem'} onClose={() => setEditingChar(null)}>
          <CharacterEditor
            cards={cards} weapons={weapons} seals={seals} arsenalCards={arsenalCards}
            initialData={editingChar === 'new' ? undefined : editingChar}
            onSubmit={char => { onSaveCharacter(char); setEditingChar(null); }}
            onDelete={id => { onDeleteCharacter(id); setEditingChar(null); }}
          />
        </EditorFrame>
      )}

      {editingNpc && (
        <EditorFrame title="Editar NPC" onClose={() => setEditingNpcId(null)}>
          <CharacterEditor
            cards={cards} weapons={weapons} seals={seals} arsenalCards={arsenalCards}
            initialData={editingNpc}
            onSubmit={char => { onEditNpc(editingNpc.id, char); setEditingNpcId(null); }}
            onDelete={() => { onRemoveNpc(editingNpc.id); setEditingNpcId(null); }}
          />
        </EditorFrame>
      )}
    </>
  );
};

export default CharacterManagerModal;

const loadMoreButton: React.CSSProperties = {
  padding: '10px 16px',
  border: '1px solid #51465f',
  borderRadius: 8,
  background: '#1c1827',
  color: '#e5d9f4',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
