import { describe, expect, it } from 'vitest';

import { validateBasicAuth } from './_middleware';

const env = {
  FAMILY_AUTH_USERNAME: 'family',
  FAMILY_AUTH_PASSWORD: 'shared-secret',
};

const basicHeader = (username: string, password: string): string =>
  `Basic ${btoa(`${username}:${password}`)}`;

describe('Cloudflare Pages Basic Auth middleware validation', () => {
  it('rejects missing Authorization headers', () => {
    expect(validateBasicAuth(null, env)).toBe('rejected');
  });

  it('rejects the wrong Authorization scheme', () => {
    expect(validateBasicAuth(`Bearer ${btoa('family:shared-secret')}`, env)).toBe('rejected');
  });

  it('rejects malformed base64 credentials', () => {
    expect(validateBasicAuth('Basic not-base64!', env)).toBe('rejected');
  });

  it('rejects credentials without a username and password separator', () => {
    expect(validateBasicAuth(`Basic ${btoa('family')}`, env)).toBe('rejected');
  });

  it('rejects an incorrect username', () => {
    expect(validateBasicAuth(basicHeader('other-family', 'shared-secret'), env)).toBe('rejected');
  });

  it('rejects an incorrect password', () => {
    expect(validateBasicAuth(basicHeader('family', 'wrong-secret'), env)).toBe('rejected');
  });

  it('accepts correct credentials', () => {
    expect(validateBasicAuth(basicHeader('family', 'shared-secret'), env)).toBe('accepted');
  });

  it('fails closed when the username secret is missing', () => {
    expect(
      validateBasicAuth(basicHeader('family', 'shared-secret'), {
        FAMILY_AUTH_PASSWORD: 'shared-secret',
      }),
    ).toBe('missing-config');
  });

  it('fails closed when the password secret is missing', () => {
    expect(
      validateBasicAuth(basicHeader('family', 'shared-secret'), {
        FAMILY_AUTH_USERNAME: 'family',
      }),
    ).toBe('missing-config');
  });
});
