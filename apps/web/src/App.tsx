import { AppRoutes } from './routes';
import type { Transport } from './net/transport';

interface Props {
  transportFactory?: () => Transport;
}

export function App({ transportFactory }: Props) {
  return <AppRoutes transportFactory={transportFactory} />;
}
