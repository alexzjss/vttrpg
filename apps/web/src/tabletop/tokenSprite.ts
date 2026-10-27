import type { Cell, Id, ProjectedCharacter, Token } from '@vtt/core';
import { Assets, Color, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Theme } from '../theme/themes';
import { cellToPx } from './geometry';

const GOLD = 0xffd54a;
const textureCache = new Map<string, Promise<Texture | null>>();

/** Carrega (e guarda em cache por url) a textura; null se a url é vazia ou falha. */
export function loadTexture(url: string): Promise<Texture | null> {
  if (!url) return Promise.resolve(null);
  let p = textureCache.get(url);
  if (!p) {
    p = Assets.load<Texture>(url).then((t) => t ?? null).catch(() => null);
    textureCache.set(url, p);
  }
  return p;
}

export const hex = (css: string): number => new Color(css).toNumber();

/** Centro do token em coordenadas de mundo (a célula é o canto superior esquerdo). */
export function tokenCenter(cell: Cell, size: number, cellSize: number): { x: number; y: number } {
  const c = cellToPx(cell, cellSize);
  const off = ((size - 1) * cellSize) / 2;
  return { x: c.x + off, y: c.y + off };
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

export interface TokenViewData {
  token: Token;
  character: ProjectedCharacter | undefined;
  theme: Theme;
  isCurrent: boolean;
  gmView: boolean;
  cellSize: number;
}

export class TokenView extends Container {
  readonly tokenId: Id;
  /** Posição de repouso (derivada do estado) em mundo. */
  home = { x: 0, y: 0 };
  tweening = false;
  dragging = false;
  pulseStart = -1;
  private body = new Container();
  private glow = new Graphics();
  private ring = new Graphics();
  private arc = new Graphics();
  private eye = new Graphics();
  private clip = new Graphics();
  private image: Sprite | null = null;
  private initialsText = new Text({ text: '', style: { fill: '#ffffff', fontWeight: 'bold' } });
  private nameText = new Text({ text: '', style: { fontSize: 12 } });
  private imageUrl: string | null = null;
  private radius = 0;

  constructor(tokenId: Id) {
    super();
    this.tokenId = tokenId;
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.initialsText.anchor.set(0.5);
    this.nameText.anchor.set(0.5, 0);
    this.body.addChild(this.glow, this.initialsText, this.ring, this.arc, this.eye);
    this.addChild(this.body, this.nameText);
  }

  update(d: TokenViewData): void {
    const { token, character, theme, cellSize } = d;
    const r = (cellSize * token.size) / 2 - 4;
    this.radius = r;
    this.home = tokenCenter(token.cell, token.size, cellSize);
    const ghost = d.gmView && token.hidden;
    this.alpha = ghost ? 0.45 : 1;

    const color = hex(character?.kind === 'npc' ? theme.colors.npc : theme.colors.pc);
    this.glow.clear();
    if (d.isCurrent) {
      this.glow.circle(0, 0, r + 9).fill({ color: GOLD, alpha: 0.3 })
        .circle(0, 0, r + 5).stroke({ width: 3, color: GOLD });
    }
    // O fundo fica na camada de baixo (sob a imagem); o anel só contorna.
    this.glow.circle(0, 0, r).fill({ color: hex(theme.colors.surfaceAlt) });
    this.ring.clear().circle(0, 0, r).stroke({ width: 4, color });
    this.drawArc(character, r, theme);
    this.drawEye(ghost, r);
    this.clip.clear().circle(0, 0, r - 2).fill(0xffffff);

    const name = character?.name ?? '';
    this.initialsText.text = initials(name);
    this.initialsText.style.fontSize = Math.max(10, r * 0.8);
    this.nameText.text = name;
    this.nameText.style.fill = theme.colors.text;
    this.nameText.position.set(0, r + 8);
    this.setImage(character?.tokenImage ?? '', r);
  }

  /** Escala o corpo do token (pulso de turno), sem afetar o nome. */
  setPulse(scale: number): void {
    this.body.scale.set(scale);
  }

  private drawArc(character: ProjectedCharacter | undefined, r: number, theme: Theme): void {
    this.arc.clear();
    const hp = character?.resources?.hp;
    if (!hp || hp.max <= 0) return;
    const f = Math.min(Math.max(hp.current / hp.max, 0), 1);
    if (f <= 0) return;
    const color = hex(f > 0.5 ? theme.colors.ok : f > 0.25 ? '#f59e0b' : theme.colors.danger);
    const R = r + 4;
    if (f >= 1) this.arc.circle(0, 0, R).stroke({ width: 4, color });
    else this.arc.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f).stroke({ width: 4, color });
  }

  private drawEye(show: boolean, r: number): void {
    this.eye.clear();
    if (!show) return;
    const x = r * 0.6;
    const y = -r * 0.6;
    this.eye.circle(x, y, 11).fill({ color: 0x000000, alpha: 0.7 })
      .ellipse(x, y, 7, 4).stroke({ width: 1.5, color: 0xffffff })
      .circle(x, y, 1.8).fill(0xffffff)
      .moveTo(x - 7, y + 6).lineTo(x + 7, y - 6).stroke({ width: 1.5, color: 0xff6b6b });
  }

  private setImage(url: string, r: number): void {
    if (url !== this.imageUrl) {
      this.imageUrl = url;
      this.image?.destroy();
      this.image = null;
      this.body.removeChild(this.clip);
      this.initialsText.visible = true;
      if (url) {
        void loadTexture(url).then((tex) => {
          if (this.destroyed || this.imageUrl !== url || !tex) return;
          const s = new Sprite(tex);
          s.anchor.set(0.5);
          s.mask = this.clip;
          this.body.addChild(this.clip); // só entra na árvore junto com a imagem
          this.image = s;
          this.initialsText.visible = false;
          this.body.addChildAt(s, 2);
          this.fitImage(this.radius);
        });
      }
    }
    this.fitImage(r);
  }

  private fitImage(r: number): void {
    const s = this.image;
    if (!s) return;
    const side = Math.min(s.texture.width, s.texture.height) || 1;
    s.scale.set((2 * r) / side);
  }
}
