import React from 'react';

export function DropCap({ children }: { children: string }) {
  const text = String(children);
  return (
    <p className="mp-dropcap-block">
      <span className="mp-dropcap">{text.slice(0, 1)}</span>{text.slice(1)}
    </p>
  );
}
