import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createFakeTransport } from '../net/fakeTransport';
import { ResourceEditor } from './ResourceEditor';

function setup() {
  const fake = createFakeTransport();
  render(
    <ResourceEditor characterId="c1" resource="hp" pool={{ current: 10, max: 20 }}
      send={(cmd) => fake.send(cmd)} />,
  );
  return fake;
}

describe('ResourceEditor', () => {
  it('−5 envia setResource com current 5', () => {
    const fake = setup();
    fireEvent.click(screen.getByRole('button', { name: 'HP −5' }));
    expect(fake.sent).toEqual([{ type: 'setResource', characterId: 'c1', resource: 'hp', current: 5 }]);
  });

  it('+5 não passa do máximo', () => {
    const fake = setup();
    fireEvent.click(screen.getByRole('button', { name: 'HP +5' }));
    expect(fake.sent[0]).toMatchObject({ current: 15 });
  });

  it('campo atual envia no blur e máx no Enter', () => {
    const fake = setup();
    const cur = screen.getByLabelText('HP atual');
    fireEvent.change(cur, { target: { value: '7' } });
    fireEvent.blur(cur);
    const max = screen.getByLabelText('HP máx');
    fireEvent.change(max, { target: { value: '30' } });
    fireEvent.keyDown(max, { key: 'Enter' });
    expect(fake.sent).toEqual([
      { type: 'setResource', characterId: 'c1', resource: 'hp', current: 7 },
      { type: 'setResource', characterId: 'c1', resource: 'hp', max: 30 },
    ]);
  });

  it('valor inalterado não envia', () => {
    const fake = setup();
    fireEvent.blur(screen.getByLabelText('HP atual'));
    expect(fake.sent).toEqual([]);
  });
});
