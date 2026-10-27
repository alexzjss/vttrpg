import React from 'react';

interface WaxSealProps {
  tone?: 'crimson' | 'gold' | 'purple';
  label?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function WaxSeal({ tone = 'crimson', label, className = '', children, ...rest }: WaxSealProps) {
  return (
    <span className={`mp-wax mp-wax--${tone} ${className}`.trim()} title={label} {...(rest as React.HTMLAttributes<HTMLSpanElement>)}>
      {children}
    </span>
  );
}
