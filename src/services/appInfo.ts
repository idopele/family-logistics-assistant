import type { Language } from '../i18n';

export type AppEnvironment = 'production' | 'local';

export interface AppBuildInfo {
  version: string;
  fullSha: string;
  shortSha: string;
  branch: string | null;
  buildTime: string;
  environment: AppEnvironment;
}

interface AppBuildInfoInput {
  version?: string;
  sha?: string;
  branch?: string;
  buildTime?: string;
  environment?: string;
}

export const appBuildInfo = createAppBuildInfo({
  version: APP_VERSION,
  sha: APP_BUILD_SHA,
  branch: APP_BUILD_BRANCH,
  buildTime: APP_BUILD_TIME,
  environment: APP_ENVIRONMENT,
});

export function createAppBuildInfo(input: AppBuildInfoInput): AppBuildInfo {
  const fullSha = normalizeOptionalValue(input.sha) ?? 'local';
  const buildTime = normalizeOptionalValue(input.buildTime) ?? '';

  return {
    version: normalizeOptionalValue(input.version) ?? '0.0.0',
    fullSha,
    shortSha: shortenBuildSha(fullSha),
    branch: normalizeOptionalValue(input.branch),
    buildTime,
    environment: input.environment === 'production' ? 'production' : 'local',
  };
}

export function shortenBuildSha(sha: string): string {
  return sha === 'local' || sha.trim() === '' ? 'local' : sha.trim().slice(0, 7);
}

export function formatBuildDate(buildTime: string, language: Language): string {
  const parsedDate = new Date(buildTime);

  if (Number.isNaN(parsedDate.getTime())) {
    return buildTime;
  }

  return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue === undefined || normalizedValue === '' ? null : normalizedValue;
}
