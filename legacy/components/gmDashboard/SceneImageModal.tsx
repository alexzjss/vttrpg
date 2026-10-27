import React from 'react';
import { Image as ImageIcon, Pause } from 'lucide-react';
import type { SceneState } from '../../utils/cena';
import { ImagePickerButton } from '../ui/ImagePickerButton';

export interface SceneImageModalProps {
  scene: SceneState;
  onSceneChange: (partial: Partial<SceneState>) => void;
}

const sectionStyle: React.CSSProperties = {
  padding: '18px 22px', borderBottom: '1px solid var(--border-faint)',
};

const SceneImageModal: React.FC<SceneImageModalProps> = ({ scene, onSceneChange }) => (
  <div role="region" aria-label="Imagem de fundo da cena">
    <header className="flex items-center gap-4 p-7 pb-5 border-b" style={{ borderColor: 'var(--border-gold)' }}>
      <ImageIcon size={28} color="var(--text-primary)" aria-hidden />
      <div>
        <span style={{ color: 'var(--accent-gold, #d9b76e)', fontSize: 10, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase' }}>CENÁRIO</span>
        <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>Imagem de Fundo</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>{scene.locationName || 'Local Desconhecido'}</p>
      </div>
    </header>

    <section style={sectionStyle}>
      <h3 style={{ margin: '0 0 4px', fontFamily: "'Cinzel', serif", fontSize: 15, color: 'var(--text-primary)' }}>Prévia</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 12 }}>A imagem aparece desfocada atrás do tabuleiro e nítida no mapa de combate.</p>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 520, height: 260, borderRadius: 8, overflow: 'hidden',
        background: scene.image ? undefined : 'repeating-linear-gradient(45deg,#1a1c24,#1a1c24 10px,#15161c 10px,#15161c 20px)',
        border: '1px solid var(--border-faint)', display: 'grid', placeItems: 'center',
      }}>
        {scene.image
          ? <img src={scene.image} alt="Imagem de fundo da cena" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: scene.imagePosition || '50% 50%' }} />
          : <span style={{ color: 'var(--text-faint, #6d675c)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Nenhuma imagem definida</span>}
      </div>
    </section>

    <section style={{ ...sectionStyle, borderBottom: 'none' }}>
      <h3 style={{ margin: '0 0 4px', fontFamily: "'Cinzel', serif", fontSize: 15, color: 'var(--text-primary)' }}>Trocar imagem</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 12 }}>Envie um arquivo ou cole uma URL. A troca aparece para todos os jogadores em tempo real.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <ImagePickerButton
          value={scene.image}
          onUpdate={url => onSceneChange({ image: url })}
          position={scene.imagePosition}
          onPositionChange={imagePosition => onSceneChange({ imagePosition })}
          label="Imagem da cena"
          buttonLabel={scene.image ? 'Trocar imagem' : 'Definir imagem'}
          showPreviewInline={false}
        />
        {scene.image && <button onClick={() => onSceneChange({ image: '' })}
          style={{ padding: '8px 14px', color: '#ffd9de', background: 'rgba(220,38,38,.18)', border: '1px solid rgba(220,38,38,.4)', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
          Remover imagem
        </button>}
      </div>
    </section>

    <section style={{ ...sectionStyle, borderBottom: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Pause size={15} color="var(--accent-gold, #d9b76e)" />
        <h3 style={{ margin: 0, fontFamily: "'Cinzel', serif", fontSize: 15, color: 'var(--text-primary)' }}>Imagem de combate pausado</h3>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 12 }}>Substitui a cena em tela cheia, com uma cortina de transição, sempre que o mestre pausar o combate. Deixe vazio para não usar esse efeito.</p>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 520, height: 180, borderRadius: 8, overflow: 'hidden', marginBottom: 12,
        background: scene.pausedImage ? undefined : 'repeating-linear-gradient(45deg,#1a1c24,#1a1c24 10px,#15161c 10px,#15161c 20px)',
        border: '1px solid var(--border-faint)', display: 'grid', placeItems: 'center',
      }}>
        {scene.pausedImage
          ? <img src={scene.pausedImage} alt="Imagem de combate pausado" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: scene.pausedImagePosition || '50% 50%' }} />
          : <span style={{ color: 'var(--text-faint, #6d675c)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Nenhuma imagem definida</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <ImagePickerButton
          value={scene.pausedImage ?? ''}
          onUpdate={url => onSceneChange({ pausedImage: url })}
          position={scene.pausedImagePosition}
          onPositionChange={pausedImagePosition => onSceneChange({ pausedImagePosition })}
          label="Imagem de combate pausado"
          buttonLabel={scene.pausedImage ? 'Trocar imagem' : 'Definir imagem'}
          showPreviewInline={false}
        />
        {scene.pausedImage && <button onClick={() => onSceneChange({ pausedImage: '' })}
          style={{ padding: '8px 14px', color: '#ffd9de', background: 'rgba(220,38,38,.18)', border: '1px solid rgba(220,38,38,.4)', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>
          Remover imagem
        </button>}
      </div>
    </section>
  </div>
);

export default SceneImageModal;
