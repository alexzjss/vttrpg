import React from 'react';
import { BookmarkPlus, Map, Trash2 } from 'lucide-react';
import type { Character } from '../../types';
import type { CenaState, SceneLibraryTemplate } from '../../utils/cena';
import { listSceneTemplates } from '../../utils/sceneLibrary';

interface SceneLibraryPanelProps {
  cena: CenaState;
  participants: Character[];
  onApplyTemplate: (template: SceneLibraryTemplate) => void;
  onSaveCurrent: (name: string, description: string) => void;
  onRemoveTemplate: (templateId: string) => void;
}

const SceneLibraryPanel: React.FC<SceneLibraryPanelProps> = ({
  cena, participants, onApplyTemplate, onSaveCurrent, onRemoveTemplate,
}) => {
  const [name, setName] = React.useState(cena.scene.locationName || 'Cena salva');
  const [description, setDescription] = React.useState('');
  const templates = listSceneTemplates(cena);
  const customIds = new Set(cena.sceneLibrary.map(template => template.id));
  const save = () => {
    onSaveCurrent(name, description);
    setName(cena.scene.locationName || 'Cena salva');
    setDescription('');
  };

  return (
    <div className="scene-library">
      <style>{`
        .scene-library{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:16px;color:#dfe4ec}
        .scene-library__capture,.scene-library__list{border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025);padding:16px}
        .scene-library h3{margin:0 0 4px;color:#f4f6f8;font-size:16px}.scene-library p{margin:0;color:#7c8796;font-size:12px;line-height:1.45}
        .scene-library label{display:block;margin-top:12px;color:#818b99;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        .scene-library input,.scene-library textarea{width:100%;box-sizing:border-box;margin-top:6px;padding:10px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.11);background:rgba(0,0,0,.26);color:#eef2f7;outline:0}.scene-library textarea{min-height:88px;resize:vertical}
        .scene-library__save{margin-top:14px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 13px;border-radius:10px;border:1px solid rgba(217,183,110,.35);background:rgba(217,183,110,.12);color:#f4ddb0;font-size:11px;font-weight:900;cursor:pointer}.scene-library__save:disabled{opacity:.45;cursor:default}
        .scene-library__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}.scene-card{display:flex;flex-direction:column;gap:10px;min-height:154px;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.18);text-align:left;color:#dfe4ec}.scene-card__top{display:flex;gap:10px}.scene-card__icon{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:rgba(217,183,110,.1);border:1px solid rgba(217,183,110,.22);color:#d9b76e;flex:none}.scene-card strong{display:block;color:#f1f4f8;font-size:13px}.scene-card small{display:block;margin-top:3px;color:#657083;font-size:10px}.scene-card p{flex:1}.scene-card__actions{display:flex;gap:8px}.scene-card button{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#cfd6df;font-size:10px;font-weight:800;cursor:pointer}.scene-card button:first-child{flex:1}.scene-card button:hover{border-color:rgba(217,183,110,.32);color:#fff}.scene-card button.is-danger{width:34px;color:#f3a3ad;border-color:rgba(244,63,94,.2);background:rgba(244,63,94,.07)}
        @media(max-width:860px){.scene-library{grid-template-columns:1fr}}
      `}</style>

      <section className="scene-library__capture">
        <h3>Salvar cena atual</h3>
        <p>Guarda cenário, notas, NPCs presentes e posições dos tokens visíveis para reutilizar em outra sessão.</p>
        <label>Nome</label>
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Nome do pacote" />
        <label>Descrição</label>
        <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Quando usar esta cena?" />
        <button className="scene-library__save" disabled={!participants.length && !cena.scene.locationName.trim()} onClick={save}>
          <BookmarkPlus size={15}/> Salvar pacote
        </button>
      </section>

      <section className="scene-library__list">
        <h3>Biblioteca de cenas</h3>
        <p>Modelos prontos e pacotes salvos pelo mestre. Aplicar um pacote reinicia a cena de combate atual.</p>
        <div className="scene-library__grid">
          {templates.map(template => (
            <article className="scene-card" key={template.id}>
              <div className="scene-card__top">
                <div className="scene-card__icon"><Map size={17}/></div>
                <div>
                  <strong>{template.name}</strong>
                  <small>{template.scene.locationName}{customIds.has(template.id) ? ' · salvo' : ' · modelo'}</small>
                </div>
              </div>
              <p>{template.description || template.scene.subtitle || 'Pacote de cena sem descrição.'}</p>
              <div className="scene-card__actions">
                <button onClick={() => onApplyTemplate(template)}>Aplicar</button>
                {customIds.has(template.id) && <button className="is-danger" aria-label={`Excluir ${template.name}`} onClick={() => onRemoveTemplate(template.id)}><Trash2 size={13}/></button>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SceneLibraryPanel;
