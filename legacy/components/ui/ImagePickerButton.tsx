import React from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Move, Trash2, Upload, X } from 'lucide-react';

interface ImagePickerButtonProps {
  value: string;
  onUpdate: (url: string) => void;
  /** CSS `object-position` / `background-position` (ex.: "50% 30%"). Só é editável se `onPositionChange` for informado. */
  position?: string;
  onPositionChange?: (position: string) => void;
  label?: string;
  buttonLabel?: string;
  accentColor?: string;
  previewHeight?: number;
  /** Mantido por compatibilidade — o seletor agora abre centralizado, então o posicionamento do gatilho não importa mais. */
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showPreviewInline?: boolean;
  compact?: boolean;
  icon?: React.ReactNode;
}

const DEFAULT_POSITION = '50% 50%';

export const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({
  value, onUpdate, position, onPositionChange, label, buttonLabel, accentColor, previewHeight = 60,
  showPreviewInline = false, compact = false, icon,
}) => {
  const [open, setOpen] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState('');
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const accent = accentColor || 'rgba(212,168,83,1)';
  const accentDim = accentColor ? `${accentColor}55` : 'rgba(212,168,83,0.25)';
  const accentFaint = accentColor ? `${accentColor}22` : 'rgba(212,168,83,0.12)';
  const posValue = position || DEFAULT_POSITION;
  const [posX, posY] = posValue.split(' ');

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('⚠️ Arquivo muito grande!\nUse imagens menores que 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => onUpdate(reader.result as string);
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const updatePositionFromPoint = (clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onPositionChange?.(`${x.toFixed(0)}% ${y.toFixed(0)}%`);
  };
  const canReposition = !!onPositionChange && !!value;
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canReposition) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updatePositionFromPoint(event.clientX, event.clientY);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updatePositionFromPoint(event.clientX, event.clientY);
  };
  const stopDrag = () => setDragging(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label || 'Imagem'}
        style={{
          background: 'rgba(22,27,38,0.9)',
          border: `1px solid ${value || accentColor ? accentDim : 'rgba(212,168,83,0.2)'}`,
          borderRadius: 8, padding: compact ? '5px 7px' : '5px 10px',
          color: value || accentColor ? accent : '#a07828', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: compact ? 8 : 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          transition: 'all 0.2s',
        }}
        className="hover:!bg-amber-900/40 hover:!text-amber-400"
      >
        {icon || <ImageIcon style={{ width: 10, height: 10 }} />}
        {!compact && (buttonLabel || label || 'Imagem')} {value && !compact ? '●' : ''}
      </button>

      {showPreviewInline && value && (
        <div style={{ position: 'relative', width: '100%' }}>
          <img src={value} alt="preview" style={{ width: '100%', height: previewHeight, objectFit: 'cover', objectPosition: posValue, borderRadius: 8, border: `1px solid ${accentDim}` }} />
          <button onClick={() => onUpdate('')} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', border: '2px solid #0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: 9, fontWeight: 900 }}>×</button>
        </div>
      )}

      {open && createPortal(
        <div
          role="dialog" aria-modal="true" aria-label={label || 'Imagem'}
          onMouseDown={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(4,5,9,.82)', backdropFilter: 'blur(14px)' }}
        >
          <div
            onMouseDown={event => event.stopPropagation()}
            style={{ width: 'min(440px,92vw)', background: 'rgba(16,18,26,0.98)', border: `1px solid ${accentDim}`, borderRadius: 14, padding: 16, boxShadow: '0 30px 90px rgba(0,0,0,.85)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <p style={{ flex: 1, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#c9a866', margin: 0 }}>{label || 'Imagem'}</p>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: '#cbd5e1', cursor: 'pointer' }}><X size={13} /></button>
            </div>

            <div
              ref={previewRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              style={{
                position: 'relative', width: '100%', height: 260, borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${accentDim}`, touchAction: 'none',
                background: value
                  ? `url(${value}) ${posValue} / cover no-repeat`
                  : 'repeating-linear-gradient(45deg,#1a1c24,#1a1c24 10px,#15161c 10px,#15161c 20px)',
                cursor: canReposition ? (dragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {!value && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#5a5a62', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Nenhuma imagem
                </div>
              )}
              {canReposition && (
                <>
                  <div aria-hidden style={{ position: 'absolute', left: posX, top: posY, width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.6), 0 2px 10px rgba(0,0,0,.65)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,.62)', color: '#e8d7b9', fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', pointerEvents: 'none' }}>
                    <Move size={10} /> Arraste para ajustar o foco
                  </div>
                </>
              )}
              {value && (
                <button onClick={() => onUpdate('')} title="Remover imagem" style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(220,38,38,.85)', border: '2px solid rgba(15,17,23,.9)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'white' }}><Trash2 size={12} /></button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              <input
                type="text" placeholder="URL da imagem..." value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) { onUpdate(urlInput.trim()); setUrlInput(''); } }}
                style={{ border: `1px solid ${accentDim}`, borderRadius: 7, padding: '8px 10px', fontSize: 11, outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
              {urlInput && (
                <button onClick={() => { onUpdate(urlInput.trim()); setUrlInput(''); }}
                  style={{ padding: '7px', borderRadius: 7, background: accentFaint, border: `1px solid ${accentDim}`, color: accent, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                  ✓ Aplicar URL
                </button>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: accentFaint, border: `1px solid ${accentDim}`, borderRadius: 7, color: accent, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
                className="hover:!bg-amber-900/40 hover:!text-amber-300"
              >
                <Upload style={{ width: 11, height: 11 }} /> Upload de arquivo
              </button>
              <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFile} />
              <button type="button" onClick={() => setOpen(false)}
                style={{ marginTop: 4, padding: '9px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', color: '#d6dde6', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', cursor: 'pointer' }}>
                Concluído
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
