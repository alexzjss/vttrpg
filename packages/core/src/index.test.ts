import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from './index';

describe('@vtt/core', () => {
  it('expõe a versão do core', () => {
    expect(CORE_VERSION).toBe('0.1.0');
  });
});
