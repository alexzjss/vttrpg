import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('mostra o login com o título VTT quando não há sessão', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /VTT/ }).tagName).toBe('H1');
  });

  it('rota protegida sem sessão redireciona para o login', () => {
    render(
      <MemoryRouter initialEntries={['/mestre']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Entrar como Mestre' })).toBeTruthy();
  });
});
