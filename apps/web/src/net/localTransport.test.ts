import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalTransport } from './localTransport';

class FakePort {
  sent: unknown[] = [];
  closed = false;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage(m: unknown) { this.sent.push(m); }
  start() {}
  close() { this.closed = true; }
}
let port: FakePort;

beforeEach(() => {
  port = new FakePort();
  const shared = port;
  vi.stubGlobal('SharedWorker', class { port = shared; });
});
afterEach(() => vi.unstubAllGlobals());

describe('localTransport: desconexão', () => {
  it('close() envia disconnect antes de fechar a porta e remove o listener de pagehide', () => {
    const t = createLocalTransport();
    t.close();
    expect(port.sent).toEqual([{ t: 'disconnect' }]);
    expect(port.closed).toBe(true);
    port.sent.length = 0;
    window.dispatchEvent(new Event('pagehide'));
    expect(port.sent).toEqual([]);
  });

  it('pagehide envia disconnect', () => {
    const t = createLocalTransport();
    window.dispatchEvent(new Event('pagehide'));
    expect(port.sent).toEqual([{ t: 'disconnect' }]);
    t.close();
  });

  it('erro load_failed rejeita connect e comandos pendentes', async () => {
    const t = createLocalTransport();
    const conn = t.connect({ role: 'gm' });
    const cmd = t.send({ type: 'nextTurn' });
    const [c, m] = port.sent as Array<{ reqId: number }>;
    port.onmessage?.({ data: { t: 'error', reqId: c!.reqId, message: 'load_failed' } } as MessageEvent);
    port.onmessage?.({ data: { t: 'error', reqId: m!.reqId, message: 'load_failed' } } as MessageEvent);
    await expect(conn).rejects.toThrow('load_failed');
    await expect(cmd).rejects.toThrow('load_failed');
    t.close();
  });
});
