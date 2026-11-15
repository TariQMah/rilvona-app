import { makePseudonym } from './pseudonym';

describe('makePseudonym', () => {
  it('is stable for a seeded generator and does not encode a user id', () => {
    const values = [0.1, 0.5, 0.2];
    let index = 0;
    const name = makePseudonym(() => values[index++] ?? 0);
    expect(name).toBe('Amber Panda 2800');
    expect(name).not.toContain('user');
  });
});
