import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';

describe('refresh token utilities', () => {
  it('generates unique, URL-safe tokens with sufficient entropy', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(second).not.toBe(first);
  });

  it('hashes tokens deterministically without retaining the token', () => {
    const token = 'sensitive-refresh-token';
    const hash = hashRefreshToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashRefreshToken(token));
    expect(hash).not.toContain(token);
  });
});
