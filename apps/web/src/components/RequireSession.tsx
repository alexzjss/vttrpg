import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Actor } from '@vtt/core';
import { getSession } from '../session/session';

interface Props {
  role?: Actor['role'];
  children: ReactNode;
}

/** Sem sessão (ou com papel errado) volta ao login. */
export function RequireSession({ role, children }: Props) {
  const session = getSession();
  if (!session || (role !== undefined && session.actor.role !== role)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
