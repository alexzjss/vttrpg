import { useEffect } from 'react';

export interface Notice { id: number; text: string }

/** Mostra o aviso por 4 s. O id muda a cada falha, então o mesmo erro reaparece. */
export function ErrorToast({ notice, onDismiss }: { notice: Notice | null; onDismiss(): void }) {
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [notice, onDismiss]);
  if (!notice) return null;
  return (
    <div className="error-toast" role="alert">
      {notice.text}
    </div>
  );
}
