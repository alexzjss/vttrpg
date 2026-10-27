import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renderiza o título VTT', () => {
    render(<App />);
    expect(screen.getByText('VTT').tagName).toBe('H1');
  });
});
