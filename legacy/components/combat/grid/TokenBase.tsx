import React from 'react';

interface TokenBaseProps {
  teamColor: string;
}

const TokenBase: React.FC<TokenBaseProps> = ({ teamColor }) => (
  <>
    {/* Marca de brasa / chamuscado no chão */}
    <div style={{
      position: 'absolute',
      bottom: -7,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '96%',
      height: 12,
      borderRadius: '50%',
      background: `radial-gradient(ellipse, ${teamColor} 0%, rgba(120,20,40,0.6) 45%, transparent 72%)`,
      filter: 'blur(5px)',
      opacity: 0.5,
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      bottom: -4,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '60%',
      height: 5,
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.55)',
      filter: 'blur(3px)',
      pointerEvents: 'none',
    }} />
  </>
);

export default TokenBase;
