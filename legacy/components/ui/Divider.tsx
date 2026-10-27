import React from 'react';

interface DividerProps {
  className?: string;
  [key: string]: unknown;
}

export function Divider({ className = '', ...rest }: DividerProps) {
  return (
    <div role="separator" aria-hidden className={`mp-divider ${className}`.trim()} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
      <span className="mp-divider__gem" />
    </div>
  );
}
