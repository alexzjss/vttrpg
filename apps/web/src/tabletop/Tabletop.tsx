import type { Cell, Id, ProjectedState } from '@vtt/core';
import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import type { Theme } from '../theme/themes';
import { TabletopApp } from './TabletopApp';

export interface TabletopProps {
  state: ProjectedState;
  theme: Theme;
  gmView: boolean;
  canDrag(tokenId: Id): boolean;
  onTokenDrop(tokenId: Id, cell: Cell): void;
  onTokenSelect?(tokenId: Id | null): void;
}

export function Tabletop(props: TabletopProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<TabletopApp | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let unmounted = false;
    // Os callbacks leem sempre as props mais recentes; o app é criado uma única vez.
    TabletopApp.create(host, {
      theme: latest.current.theme,
      gmView: latest.current.gmView,
      canDrag: (id) => latest.current.canDrag(id),
      onTokenDrop: (id, cell) => latest.current.onTokenDrop(id, cell),
      onTokenSelect: (id) => latest.current.onTokenSelect?.(id),
    }).then(
      (app) => {
        if (unmounted) {
          app.destroy();
          return;
        }
        appRef.current = app;
        app.setOptions({ theme: latest.current.theme, gmView: latest.current.gmView });
        app.render(latest.current.state);
        app.playCues(useGame.getState().takeCues());
      },
      (err) => console.error('Falha ao iniciar o tabuleiro', err),
    );
    return () => {
      unmounted = true;
      appRef.current?.destroy();
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    appRef.current?.setOptions({ theme: props.theme, gmView: props.gmView });
  }, [props.theme, props.gmView]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    app.render(props.state);
    app.playCues(useGame.getState().takeCues());
  }, [props.state]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />;
}
