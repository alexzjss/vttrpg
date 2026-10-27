import React from 'react';
import {
  Maximize2, Minimize2, Image, Grid3X3, Ruler, Circle,
  Triangle, Minus, Eye, EyeOff, RefreshCcw,
} from 'lucide-react';
import { ToolbarMode } from '../../../types';

interface ArenaToolbarProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
  toolbarMode: ToolbarMode;
  onSetMode: (mode: ToolbarMode) => void;
  backgroundImage: string;
  onSetBackground: (url: string) => void;
  fogEnabled: boolean;
  onToggleFog: () => void;
  onRevealAll: () => void;
  onHideAll: () => void;
  onOpenPlayerWindow: () => void;
}

const btn = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 9px', borderRadius: 6, cursor: 'pointer',
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase',
  background: active ? 'rgba(201,152,58,0.2)' : 'rgba(8,10,20,0.85)',
  border: `1px solid ${active ? 'rgba(201,152,58,0.6)' : 'rgba(255,255,255,0.08)'}`,
  color: active ? '#e8c878' : 'rgba(255,255,255,0.55)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
  transition: 'all 0.15s',
});

const ArenaToolbar: React.FC<ArenaToolbarProps> = ({
  isFullscreen, onToggleFullscreen,
  gridVisible, onToggleGrid,
  toolbarMode, onSetMode,
  backgroundImage, onSetBackground,
  fogEnabled, onToggleFog, onRevealAll, onHideAll,
  onOpenPlayerWindow,
}) => {
  const toggle = (mode: ToolbarMode) =>
    onSetMode(toolbarMode === mode ? 'none' : mode);

  return (
    <>
      {/* Top-left */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 80, display: 'flex', gap: 6 }}>
        <button style={btn(false)} onClick={onOpenPlayerWindow}>
          <Eye size={11} /> Jogadores
        </button>
        <button style={btn(isFullscreen)} onClick={onToggleFullscreen}>
          {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          {isFullscreen ? 'Sair' : 'Full'}
        </button>
      </div>

      {/* Top-right */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 80, display: 'flex', gap: 6 }}>
        <button style={btn(gridVisible)} onClick={onToggleGrid}>
          <Grid3X3 size={11} />
        </button>
        <button
          style={btn(false)}
          title="Cenário (URL)"
          onClick={() => {
            const url = prompt('URL da imagem de cenário:', backgroundImage);
            if (url !== null) onSetBackground(url);
          }}
        >
          <Image size={11} />
        </button>
        <button style={btn(toolbarMode === 'ruler')} onClick={() => toggle('ruler')}>
          <Ruler size={11} /> Régua
        </button>
        <button style={btn(toolbarMode === 'aoe-circle')} onClick={() => toggle('aoe-circle')}>
          <Circle size={11} />
        </button>
        <button style={btn(toolbarMode === 'aoe-cone')} onClick={() => toggle('aoe-cone')}>
          <Triangle size={11} />
        </button>
        <button style={btn(toolbarMode === 'aoe-line')} onClick={() => toggle('aoe-line')}>
          <Minus size={11} />
        </button>
      </div>

      {/* Fog controls — bottom-right */}
      <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 80, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button style={btn(fogEnabled)} onClick={onToggleFog}>
          {fogEnabled ? <EyeOff size={11} /> : <Eye size={11} />} Névoa
        </button>
        {fogEnabled && (
          <>
            <button style={btn(toolbarMode === 'fog-reveal')} onClick={() => toggle('fog-reveal')}>
              Revelar
            </button>
            <button style={btn(toolbarMode === 'fog-hide')} onClick={() => toggle('fog-hide')}>
              Ocultar
            </button>
            <button style={btn(false)} onClick={onRevealAll} title="Revelar tudo">
              <RefreshCcw size={11} />+
            </button>
            <button style={btn(false)} onClick={onHideAll} title="Ocultar tudo">
              <RefreshCcw size={11} />−
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default ArenaToolbar;
