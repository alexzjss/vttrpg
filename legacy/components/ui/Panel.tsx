import React from 'react';

type PanelVariant = 'dark' | 'parchment' | 'raised';

interface PanelProps {
  variant?: PanelVariant;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function Panel({ variant = 'dark', className = '', children, ...rest }: PanelProps) {
  return (
    <div className={`mp-panel mp-panel--${variant} ${className}`.trim()} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
      <span aria-hidden className="mp-panel__canvas" />
      {children}
    </div>
  );
}
