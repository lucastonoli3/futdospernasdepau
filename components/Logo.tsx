import React, { useState } from 'react';
import { CLUB } from '../brandConfig';

/**
 * Escudo oficial do Balaio de Gato FC.
 * Usa public/escudo.png. Enquanto o arquivo não existir, mostra um
 * fallback discreto com as iniciais (sem emoji de gato).
 */
const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-gold text-black font-oswald font-black ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.34 }}
      >
        {CLUB.initials}
      </span>
    );
  }

  return (
    <img
      src={CLUB.logo}
      alt={CLUB.name}
      width={size}
      height={size}
      onError={() => setBroken(true)}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default Logo;
