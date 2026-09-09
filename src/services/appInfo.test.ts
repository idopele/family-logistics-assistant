import { describe, expect, it } from 'vitest';

import { createAppBuildInfo, formatBuildDate, shortenBuildSha } from './appInfo';

describe('app build metadata', () => {
  it('shortens a production commit SHA to seven characters', () => {
    expect(shortenBuildSha('a2b0804f7c9e1234567890')).toBe('a2b0804');
  });

  it('renders production metadata from Cloudflare build values', () => {
    const buildInfo = createAppBuildInfo({
      version: '0.12.1',
      sha: 'a2b0804f7c9e1234567890',
      branch: 'main',
      buildTime: '2026-09-08T12:30:00.000Z',
      environment: 'production',
    });

    expect(buildInfo).toEqual({
      version: '0.12.1',
      fullSha: 'a2b0804f7c9e1234567890',
      shortSha: 'a2b0804',
      branch: 'main',
      buildTime: '2026-09-08T12:30:00.000Z',
      environment: 'production',
    });
  });

  it('falls back safely to Local metadata when Cloudflare values are missing', () => {
    const buildInfo = createAppBuildInfo({});

    expect(buildInfo.version).toBe('0.0.0');
    expect(buildInfo.fullSha).toBe('local');
    expect(buildInfo.shortSha).toBe('local');
    expect(buildInfo.branch).toBeNull();
    expect(buildInfo.environment).toBe('local');
  });

  it('formats the supplied build timestamp instead of creating a new dialog-open timestamp', () => {
    const buildTime = '2026-09-08T12:30:00.000Z';
    const formattedBuildDate = formatBuildDate(buildTime, 'en');

    expect(formattedBuildDate).toContain('2026');
    expect(formatBuildDate('not-a-date', 'he')).toBe('not-a-date');
  });
});
