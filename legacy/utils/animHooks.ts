import { useEffect, useRef, useState } from 'react';

/** Retorna true por `duration`ms sempre que `active` passa de false para true. */
export function useTransientOnChange(active: boolean, duration = 700): boolean {
  const prevRef = useRef(active);
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    if (active && !prevRef.current) {
      setFlag(true);
      const timer = setTimeout(() => setFlag(false), duration);
      prevRef.current = active;
      return () => clearTimeout(timer);
    }
    prevRef.current = active;
  }, [active, duration]);
  return flag;
}

/** Barra "fantasma": ao cair, mantém o valor anterior por `catchUpDelay`ms antes de acompanhar a queda. */
export function useGhostPct(pct: number, catchUpDelay = 260): number {
  const prevRef = useRef(pct);
  const [ghost, setGhost] = useState(pct);
  useEffect(() => {
    if (pct < prevRef.current) {
      setGhost(prevRef.current);
      const timer = setTimeout(() => setGhost(pct), catchUpDelay);
      prevRef.current = pct;
      return () => clearTimeout(timer);
    }
    setGhost(pct);
    prevRef.current = pct;
  }, [pct, catchUpDelay]);
  return ghost;
}
