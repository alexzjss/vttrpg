import { AppRoutes } from './routes';
import type { Session, Transport } from './net/transport';

interface Props {
  transportFactory?: (session: Session) => Transport;
}

export function App({ transportFactory }: Props) {
  return <AppRoutes transportFactory={transportFactory} />;
}
