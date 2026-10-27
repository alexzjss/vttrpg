import { get, set } from 'idb-keyval';
import type { CampaignState } from '@vtt/core';
import type { ClientMessage } from './protocol';
import { createWorkerHost } from './workerHost';

const KEY = 'vtt-local-campaign';

const host = createWorkerHost({
  load: () => get<CampaignState>(KEY),
  save: (s) => set(KEY, s),
});

interface WorkerPort {
  postMessage(m: unknown): void;
  onmessage: ((ev: MessageEvent<ClientMessage>) => void) | null;
  start(): void;
}

(self as unknown as { onconnect: (e: { ports: WorkerPort[] }) => void }).onconnect = (e) => {
  const port = e.ports[0]!;
  const handle = host.attach(port);
  port.onmessage = (ev) => handle(ev.data);
  port.start();
};
