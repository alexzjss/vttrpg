import React from 'react';

export function TabSweep({ tabKey, label }: { tabKey: string; label: string }) {
  return (
    <div key={tabKey} className="mp-tab-sweep" aria-hidden>
      <span className="mp-tab-sweep__word">{label}</span>
    </div>
  );
}
