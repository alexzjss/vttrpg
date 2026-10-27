import type { Cell, Cue, Id, ProjectedState } from '@vtt/core';
import { Application, Container, type FederatedPointerEvent, Graphics, Sprite } from 'pixi.js';
import type { Theme } from '../theme/themes';
import { fitGrid, hasArea, pan, screenToWorld, zoomAt, type Camera } from './camera';
import { clampCell, pxToCell } from './geometry';
import { hex, loadTexture, tokenCenter, TokenView } from './tokenSprite';

export interface TabletopOptions {
  theme: Theme;
  gmView: boolean;
  canDrag(tokenId: Id): boolean;
  onTokenDrop(tokenId: Id, cell: Cell): void;
  onTokenSelect?(tokenId: Id | null): void;
}

interface Tween { view: TokenView; from: { x: number; y: number }; start: number }
type Drag =
  | { kind: 'pan'; last: { x: number; y: number }; moved: boolean }
  | { kind: 'token'; view: TokenView; start: { x: number; y: number }; moved: boolean };

const MOVE_MS = 250;
const PULSE_MS = 600;
const CLICK_SLOP = 4;

export class TabletopApp {
  private world = new Container();
  private bgLayer = new Container();
  private gridGfx = new Graphics();
  private highlight = new Graphics();
  private tokenLayer = new Container();
  private views = new Map<Id, TokenView>();
  private tweens: Tween[] = [];
  private camera: Camera = { x: 0, y: 0, zoom: 1 };
  private state: ProjectedState | null = null;
  private fitKey = '';
  private gridKey = '';
  private bgUrl: string | null = null;
  private drag: Drag | null = null;
  private destroyed = false;
  private userMoved = false;

  private constructor(private app: Application, private opts: TabletopOptions) {
    this.world.addChild(this.bgLayer, this.gridGfx, this.highlight, this.tokenLayer);
    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', this.onStageDown);
    app.stage.on('pointermove', this.onMove);
    app.stage.on('pointerup', this.onUp);
    app.stage.on('pointerupoutside', this.onUp);
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    app.ticker.add(this.tick);
    app.renderer.on('resize', this.onResize);
  }

  static async create(host: HTMLElement, opts: TabletopOptions): Promise<TabletopApp> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: hex(opts.theme.colors.bg),
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    host.appendChild(app.canvas);
    return new TabletopApp(app, opts);
  }

  setOptions(opts: Partial<TabletopOptions>): void {
    if (this.destroyed) return;
    const themeChanged = opts.theme !== undefined && opts.theme !== this.opts.theme;
    const gmChanged = opts.gmView !== undefined && opts.gmView !== this.opts.gmView;
    this.opts = { ...this.opts, ...opts };
    if (themeChanged) {
      this.app.renderer.background.color = hex(this.opts.theme.colors.bg);
      this.gridKey = '';
    }
    if ((themeChanged || gmChanged) && this.state) this.render(this.state);
  }

  render(state: ProjectedState): void {
    if (this.destroyed) return;
    this.state = state;
    const { grid } = state.scene;
    const key = `${grid.cols}x${grid.rows}x${grid.cellSize}`;
    if (key !== this.fitKey && this.fit(grid)) {
      this.fitKey = key;
      this.userMoved = false;
    }
    this.drawGrid(state);
    this.syncBackground(state);

    const seen = new Set<Id>();
    for (const token of Object.values(state.scene.tokens)) {
      if (token.hidden && !this.opts.gmView) continue;
      seen.add(token.id);
      let view = this.views.get(token.id);
      if (!view) {
        const created = new TokenView(token.id);
        created.on('pointerdown', (e: FederatedPointerEvent) => this.onTokenDown(created, e));
        const p = tokenCenter(token.cell, token.size, grid.cellSize);
        created.position.set(p.x, p.y);
        this.views.set(token.id, created);
        this.tokenLayer.addChild(created);
        view = created;
      }
      view.update({
        token,
        character: state.characters[token.characterId],
        theme: this.opts.theme,
        isCurrent: state.encounter.currentTokenId === token.id,
        gmView: this.opts.gmView,
        cellSize: grid.cellSize,
      });
      if (!view.tweening && !view.dragging) view.position.set(view.home.x, view.home.y);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      this.tweens = this.tweens.filter((t) => t.view !== view);
      if (this.drag?.kind === 'token' && this.drag.view === view) this.drag = null;
      view.destroy({ children: true });
      this.views.delete(id);
    }
  }

  playCues(cues: Cue[]): void {
    if (this.destroyed || !this.state) return;
    const cellSize = this.state.scene.grid.cellSize;
    for (const cue of cues) {
      if (cue.type === 'token-moved') {
        const view = this.views.get(cue.tokenId);
        if (!view || view.dragging) continue;
        const from = tokenCenter(cue.from, 1, cellSize);
        view.position.set(from.x, from.y);
        view.tweening = true;
        this.tweens = this.tweens.filter((t) => t.view !== view);
        this.tweens.push({ view, from, start: performance.now() });
      } else if (cue.type === 'turn-started') {
        const view = this.views.get(cue.tokenId);
        if (view) view.pulseStart = performance.now();
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.ticker.remove(this.tick);
    this.app.renderer.off('resize', this.onResize);
    this.app.canvas.removeEventListener('wheel', this.onWheel);
    this.app.destroy({ removeView: true }, { children: true });
  }

  private tick = (): void => {
    const now = performance.now();
    this.tweens = this.tweens.filter((t) => {
      const k = Math.min((now - t.start) / MOVE_MS, 1);
      const e = 1 - (1 - k) ** 3;
      t.view.position.set(
        t.from.x + (t.view.home.x - t.from.x) * e,
        t.from.y + (t.view.home.y - t.from.y) * e,
      );
      if (k >= 1) t.view.tweening = false;
      return k < 1;
    });
    for (const v of this.views.values()) {
      if (v.pulseStart < 0) continue;
      const k = (now - v.pulseStart) / PULSE_MS;
      if (k >= 1) {
        v.pulseStart = -1;
        v.setPulse(1);
      } else {
        v.setPulse(1 + 0.25 * Math.sin(Math.PI * k));
      }
    }
  };

  private fit(grid: ProjectedState['scene']['grid']): boolean {
    const viewport = { w: this.app.screen.width, h: this.app.screen.height };
    if (!hasArea(viewport)) return false;
    this.camera = fitGrid(grid, viewport);
    this.applyCamera();
    return true;
  }

  private onResize = (): void => {
    if (this.destroyed || this.userMoved || !this.state) return;
    this.fit(this.state.scene.grid);
    if (this.fitKey === '') this.render(this.state);
  };

  private applyCamera(): void {
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.zoom);
  }

  private drawGrid(state: ProjectedState): void {
    const { cols, rows, cellSize, visible } = state.scene.grid;
    const key = `${cols}x${rows}x${cellSize}x${visible}x${this.opts.theme.colors.grid}`;
    if (key === this.gridKey) return;
    this.gridKey = key;
    this.gridGfx.clear();
    if (!visible) return;
    const w = cols * cellSize;
    const h = rows * cellSize;
    for (let c = 0; c <= cols; c++) this.gridGfx.moveTo(c * cellSize, 0).lineTo(c * cellSize, h);
    for (let r = 0; r <= rows; r++) this.gridGfx.moveTo(0, r * cellSize).lineTo(w, r * cellSize);
    this.gridGfx.stroke({ width: 1, color: hex(this.opts.theme.colors.grid), alpha: 0.35 });
  }

  private syncBackground(state: ProjectedState): void {
    const url = state.scene.background;
    if (url === this.bgUrl) return;
    this.bgUrl = url;
    this.bgLayer.removeChildren().forEach((c) => c.destroy());
    if (!url) return;
    void loadTexture(url).then((tex) => {
      if (this.destroyed || this.bgUrl !== url || !tex || !this.state) return;
      const g = this.state.scene.grid;
      const s = new Sprite(tex);
      s.width = g.cols * g.cellSize;
      s.height = g.rows * g.cellSize;
      this.bgLayer.addChild(s);
    });
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.userMoved = true;
    this.camera = zoomAt(this.camera, e.deltaY < 0 ? 1.1 : 1 / 1.1, pt);
    this.applyCamera();
  };

  private onStageDown = (e: FederatedPointerEvent): void => {
    if (e.target !== this.app.stage) return;
    this.drag = { kind: 'pan', last: { x: e.global.x, y: e.global.y }, moved: false };
  };

  private onTokenDown(view: TokenView, e: FederatedPointerEvent): void {
    e.stopPropagation();
    view.dragging = this.opts.canDrag(view.tokenId);
    this.drag = { kind: 'token', view, start: { x: e.global.x, y: e.global.y }, moved: false };
  }

  private onMove = (e: FederatedPointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pan') {
      const dx = e.global.x - d.last.x;
      const dy = e.global.y - d.last.y;
      if (dx !== 0 || dy !== 0) d.moved = true;
      d.last = { x: e.global.x, y: e.global.y };
      this.userMoved = true;
      this.camera = pan(this.camera, dx, dy);
      this.applyCamera();
      return;
    }
    if (Math.hypot(e.global.x - d.start.x, e.global.y - d.start.y) > CLICK_SLOP) d.moved = true;
    if (!d.moved || !d.view.dragging || !this.state) return;
    const w = screenToWorld(this.camera, e.global);
    d.view.position.set(w.x, w.y);
    const g = this.state.scene.grid;
    this.drawHighlight(clampCell(pxToCell(w, g.cellSize), g), g.cellSize);
  };

  private onUp = (e: FederatedPointerEvent): void => {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'pan') {
      if (!d.moved) this.opts.onTokenSelect?.(null);
      return;
    }
    const { view } = d;
    this.highlight.clear();
    const wasDragging = view.dragging;
    view.dragging = false;
    if (wasDragging) view.position.set(view.home.x, view.home.y);
    if (!d.moved || !wasDragging) {
      if (!d.moved) this.opts.onTokenSelect?.(view.tokenId);
      return;
    }
    if (!this.state) return;
    const g = this.state.scene.grid;
    const cell = clampCell(pxToCell(screenToWorld(this.camera, e.global), g.cellSize), g);
    const cur = this.state.scene.tokens[view.tokenId]?.cell;
    if (!cur || cur.col !== cell.col || cur.row !== cell.row) this.opts.onTokenDrop(view.tokenId, cell);
  };

  private drawHighlight(cell: Cell, cs: number): void {
    const color = hex(this.opts.theme.colors.accent);
    this.highlight
      .clear()
      .rect(cell.col * cs, cell.row * cs, cs, cs)
      .fill({ color, alpha: 0.3 })
      .rect(cell.col * cs, cell.row * cs, cs, cs)
      .stroke({ width: 2, color });
  }
}
