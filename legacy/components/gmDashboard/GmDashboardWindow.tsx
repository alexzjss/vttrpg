import React from 'react';
import { BookOpen, Dice5, Image as ImageIcon, LayoutGrid, Settings, Shield, Swords, Users } from 'lucide-react';
import { useGmDashboardData } from '../../hooks/useGmDashboardData';
import { useArsenal } from '../../hooks/useArsenal';
import { useAbilityGraphs } from '../../hooks/useAbilityGraphs';
import { exportCharacterFile } from '../../utils/characterExport';
import CharacterManagerModal from '../characters/CharacterManagerModal';
import GmControlModal from '../../tabs/cena/GmControlModal';
import ArsenalModal from '../arsenal/ArsenalModal';
import SceneImageModal from './SceneImageModal';
import DiceControlPanel from './DiceControlPanel';
import OverviewPanel from './OverviewPanel';
import SceneLibraryPanel from './SceneLibraryPanel';
import OnlineSyncPanel from '../online/OnlineSyncPanel';

type Section = 'geral' | 'elenco' | 'arsenal' | 'sessao' | 'online';
type SessaoSub = 'comando' | 'dados' | 'cenario' | 'biblioteca';

const SECTIONS: { id: Section; label: string; hint: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'geral', label: 'Geral', hint: 'Resumo da sessão em andamento', icon: LayoutGrid },
  { id: 'elenco', label: 'Elenco', hint: 'Personagens e NPCs', icon: Users },
  { id: 'arsenal', label: 'Arsenal', hint: 'Cartas e equipamentos', icon: Shield },
  { id: 'sessao', label: 'Sessão', hint: 'Combate, dados secretos e cenário', icon: Settings },
  { id: 'online', label: 'Online', hint: 'Persistência e acessos', icon: Settings },
];

const SESSAO_SUBS: { id: SessaoSub; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'comando', label: 'Comando', icon: Swords },
  { id: 'dados', label: 'Dados', icon: Dice5 },
  { id: 'cenario', label: 'Cenário', icon: ImageIcon },
  { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen },
];

const SECTION_KEYS: Record<string, Section> = { '1': 'geral', '2': 'elenco', '3': 'arsenal', '4': 'sessao', '5': 'online' };

const GmDashboardWindow: React.FC = () => {
  const [section, setSection] = React.useState<Section>('geral');
  const [sessaoSub, setSessaoSub] = React.useState<SessaoSub>('comando');
  const data = useGmDashboardData();
  const { cards: arsenalCards } = useArsenal();
  const { graphs: abilityGraphs } = useAbilityGraphs();

  React.useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        window.close();
        return;
      }
      if (event.key.toLocaleLowerCase() === 'm') {
        event.preventDefault();
        data.onTogglePause();
        return;
      }
      const next = SECTION_KEYS[event.key];
      if (next) setSection(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data.onTogglePause]);

  return (
    <div className="gm-hub">
      <style>{`
        .gm-hub{--hub-gold:#d9b76e;--hub-line:rgba(217,183,110,.18);position:fixed;inset:0;display:grid;grid-template-rows:minmax(0,1fr);color:#dfe4ec;background:radial-gradient(circle at 18% -10%,rgba(137,91,38,.18),transparent 34%),radial-gradient(circle at 100% 25%,rgba(49,72,104,.15),transparent 34%),#090b10;font-family:Inter,system-ui,sans-serif;overflow:hidden}
        .gm-hub:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:32px 32px}
        .gm-hub__main{position:relative;z-index:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:clamp(10px,1.4vw,18px) clamp(14px,3vw,40px) clamp(14px,2.2vw,28px)}
        .gm-hub__legend{flex:none;margin-bottom:10px;display:flex;gap:14px;color:#565e6b;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.gm-hub__legend button{border:0;background:none;padding:0;cursor:pointer}.gm-hub__legend b{color:#8a92a0}.gm-hub__legend em{font-style:normal;color:var(--hub-gold);margin-right:4px}
        .gm-hub__subnav{flex:none;width:100%;margin:0 0 14px;display:flex;gap:8px}.gm-hub__subtab{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);color:#8a92a0;font-size:11px;font-weight:800;letter-spacing:.04em;cursor:pointer;transition:.15s}.gm-hub__subtab:hover{color:#c7cdd6;border-color:rgba(255,255,255,.18)}.gm-hub__subtab[aria-selected=true]{color:#171109;background:var(--hub-gold);border-color:var(--hub-gold)}
        .gm-hub__content{flex:1;min-height:0;width:100%;overflow:auto}
        @media(max-width:820px){.gm-hub__main{padding:12px}.gm-hub__subnav{overflow-x:auto}.gm-hub__legend{flex-wrap:wrap}}
      `}</style>
      <main className="gm-hub__main">
        <div className="gm-hub__legend" aria-label="Áreas do dashboard">
          {SECTIONS.map(({ id, label }, index) => <button type="button" key={id} onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined}><em>{index + 1}</em><b style={{ opacity: section === id ? 1 : 0.55 }}>{label}</b></button>)}
        </div>
        {section === 'sessao' && <div className="gm-hub__subnav" role="tablist" aria-label="Sub-áreas de Sessão">
          {SESSAO_SUBS.map(({ id, label, icon: Icon }) => <button key={id} className="gm-hub__subtab" role="tab" aria-selected={sessaoSub === id} onClick={() => setSessaoSub(id)}><Icon size={13}/>{label}</button>)}
        </div>}

        <section className="gm-hub__content" role="tabpanel">
          {section === 'geral' && <OverviewPanel characters={data.characters} npcRoster={data.cena.npcRoster} benchedCastIds={data.cena.benchedCastIds} cena={data.cena} onTogglePause={data.onTogglePause} onRerollInitiative={data.onRerollInitiative} onResetAllStatus={data.onResetAllStatus} onUpdateCharacter={data.updateCharacterStats} onEditNpc={data.onEditNpc} onReorderTurn={data.onReorderTurn} />}

          {section === 'elenco' && <CharacterManagerModal characters={data.characters} npcRoster={data.cena.npcRoster} benchedCastIds={data.cena.benchedCastIds} cards={data.cards} weapons={data.weapons} seals={data.seals} arsenalCards={arsenalCards} onToggleBench={data.onToggleBench} onSpawnNpc={data.onSpawnNpc} onEditNpc={data.onEditNpc} onRemoveNpc={data.onRemoveNpc} onSaveCharacter={data.saveCharacter} onDeleteCharacter={data.deleteCharacter} onExportCharacter={char => exportCharacterFile(char, arsenalCards)} />}
          {section === 'arsenal' && <ArsenalModal characters={data.characters} onUpdateCharacter={data.updateCharacterStats} />}
          {section === 'online' && <OnlineSyncPanel />}

          {section === 'sessao' && sessaoSub === 'comando' && <GmControlModal isPaused={data.cena.encounter.isPaused} round={data.cena.encounter.round} characters={data.characters} sceneParticipants={data.sceneParticipants} cards={data.cards} items={data.items} seals={data.seals} weapons={data.weapons} arsenalCards={arsenalCards} abilityGraphs={abilityGraphs} pausedDisplay={data.cena.pausedDisplay} onSetPausedDisplay={data.onSetPausedDisplay} onTogglePause={data.onTogglePause} onResetAllStatus={data.onResetAllStatus} onClearLog={data.onClearLog} onRerollInitiative={data.onRerollInitiative} onEndCombat={data.onEndCombat} streamingMode={data.cena.streamingMode} onToggleStreamingMode={data.onToggleStreamingMode} onApplyEffectToGroup={data.onApplyEffectToGroup} />}
          {section === 'sessao' && sessaoSub === 'dados' && <DiceControlPanel />}
          {section === 'sessao' && sessaoSub === 'cenario' && <SceneImageModal scene={data.cena.scene} onSceneChange={data.onSceneChange} />}
          {section === 'sessao' && sessaoSub === 'biblioteca' && <SceneLibraryPanel cena={data.cena} participants={data.sceneParticipants} onApplyTemplate={data.onApplySceneTemplate} onSaveCurrent={data.onSaveSceneTemplate} onRemoveTemplate={data.onRemoveSceneTemplate} />}
        </section>
      </main>
    </div>
  );
};

export default GmDashboardWindow;
