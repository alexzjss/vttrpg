import React from 'react';

interface KickerProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function Kicker({ className = '', children, ...rest }: KickerProps) {
  return <span className={`mp-kicker ${className}`.trim()} {...(rest as React.HTMLAttributes<HTMLSpanElement>)}>{children}</span>;
}

interface TitleProps {
  kicker?: string;
  watermark?: boolean;
  level?: 1 | 2 | 3;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function Title({ kicker, watermark, level = 2, className = '', children, ...rest }: TitleProps) {
  const Heading = `h${level}` as 'h1' | 'h2' | 'h3';
  return (
    <div className="mp-title-wrap" style={{ position: 'relative' }}>
      {watermark && <span aria-hidden className="mp-title__watermark">{children}</span>}
      {kicker && <Kicker>{kicker}</Kicker>}
      {React.createElement(Heading, { className: `mp-title ${className}`.trim(), ...(rest as React.HTMLAttributes<HTMLHeadingElement>) }, children)}
    </div>
  );
}
