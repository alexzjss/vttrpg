import React from 'react';
import { Image } from 'lucide-react';
import type { SceneState } from '../../utils/cena';
import { ImagePickerButton } from '../../components/ui/ImagePickerButton';

export interface SceneTitleProps { scene: SceneState; onSceneChange: (partial: Partial<SceneState>) => void }

const SceneTitle: React.FC<SceneTitleProps> = ({ scene, onSceneChange }) => (
  <div className="cena-scene-tools">
    <div className="cena-scene-tools__title">
      <input aria-label="Nome da cena" value={scene.locationName} onChange={event => onSceneChange({ locationName: event.target.value })} />
      <input aria-label="Subtítulo da cena" value={scene.subtitle} onChange={event => onSceneChange({ subtitle: event.target.value })} placeholder="subtítulo…" />
    </div>
    <div className="cena-scene-tools__media">
      <ImagePickerButton value={scene.image} onUpdate={image => onSceneChange({ image })} position={scene.imagePosition} onPositionChange={imagePosition => onSceneChange({ imagePosition })} label="Cenário e mapa" buttonLabel="Mapa" accentColor="#66d5df" icon={<Image size={16} />} />
    </div>
  </div>
);

export default SceneTitle;
