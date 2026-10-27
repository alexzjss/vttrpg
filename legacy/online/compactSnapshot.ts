import type { AppSnapshot } from '../utils/database';

export interface CompactedSnapshot {
  snapshot: AppSnapshot;
  removedImages: number;
}

/**
 * Remove somente imagens embutidas em base64 para manter a requisição abaixo
 * do limite das funções gratuitas. URLs normais e todos os dados de jogo são
 * preservados. Os blobs serão enviados ao Storage em uma etapa separada.
 */
export function compactSnapshotForUpload(source: AppSnapshot): CompactedSnapshot {
  let removedImages = 0;
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string' && /^data:image\//i.test(value)) {
      removedImages += 1;
      return '';
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, visit(child)]));
    }
    return value;
  };
  return { snapshot: visit(source) as AppSnapshot, removedImages };
}
