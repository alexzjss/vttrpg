import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WaxSeal } from './WaxSeal';
import { Button } from './Button';

describe('WaxSeal', () => {
  it('aplica o tom e o título', () => {
    const { container } = render(<WaxSeal tone="gold" label="fixado">★</WaxSeal>);
    const el = container.querySelector('.mp-wax');
    expect(el?.className).toContain('mp-wax--gold');
    expect(el?.getAttribute('title')).toBe('fixado');
    expect(el?.textContent).toBe('★');
  });
});

describe('Button', () => {
  it('aplica a variante e dispara onClick', () => {
    const onClick = vi.fn();
    const { getByText } = render(<Button variant="primary" onClick={onClick}>Iniciar</Button>);
    const btn = getByText('Iniciar');
    expect(btn.className).toContain('mp-cta--primary');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('respeita disabled', () => {
    const onClick = vi.fn();
    const { getByText } = render(<Button disabled onClick={onClick}>X</Button>);
    fireEvent.click(getByText('X'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
