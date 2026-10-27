import React from 'react';

interface FrameProps {
  src?: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function Frame({ src, alt = '', className = '', children, ...rest }: FrameProps) {
  return (
    <div className={`mp-frame ${className}`.trim()} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
      {src ? <img className="mp-frame__art" src={src} alt={alt} /> : children}
    </div>
  );
}
