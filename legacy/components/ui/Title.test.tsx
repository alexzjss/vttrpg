import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Title, Kicker } from './Title';
import { Divider } from './Divider';
import { DropCap } from './DropCap';

describe('Title', () => {
  it('renderiza título e kicker', () => {
    const { getByText, container } = render(<Title kicker="CAPÍTULO" level={1}>Jornada</Title>);
    expect(getByText('Jornada')).toBeTruthy();
    expect(container.querySelector('.mp-kicker')?.textContent).toBe('CAPÍTULO');
    expect(container.querySelector('h1.mp-title')).toBeTruthy();
  });
  it("mostra marca d'água quando watermark", () => {
    const { container } = render(<Title watermark>Combate</Title>);
    expect(container.querySelector('.mp-title__watermark')?.textContent).toBe('Combate');
  });
});

describe('Kicker', () => {
  it('aplica a classe', () => {
    const { container } = render(<Kicker>OK</Kicker>);
    expect(container.querySelector('.mp-kicker')).toBeTruthy();
  });
});

describe('Divider', () => {
  it('tem papel separator e o gema', () => {
    const { container } = render(<Divider />);
    expect(container.querySelector('.mp-divider')?.getAttribute('role')).toBe('separator');
    expect(container.querySelector('.mp-divider__gem')).toBeTruthy();
  });
});

describe('DropCap', () => {
  it('separa a primeira letra', () => {
    const { container } = render(<DropCap>Era uma vez</DropCap>);
    expect(container.querySelector('.mp-dropcap')?.textContent).toBe('E');
    expect(container.textContent).toBe('Era uma vez');
  });
});
