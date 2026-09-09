import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: {
  env: Record<string, string | undefined>;
};

const cloudflareCommitSha = process.env.CF_PAGES_COMMIT_SHA ?? '';
const cloudflareBranch = process.env.CF_PAGES_BRANCH ?? '';
const isCloudflareBuild = process.env.CF_PAGES === '1' || process.env.CF_PAGES_URL !== undefined || cloudflareCommitSha !== '';

export default defineConfig({
  plugins: [react()],
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    APP_BUILD_SHA: JSON.stringify(cloudflareCommitSha),
    APP_BUILD_BRANCH: JSON.stringify(cloudflareBranch),
    APP_BUILD_TIME: JSON.stringify(new Date().toISOString()),
    APP_ENVIRONMENT: JSON.stringify(isCloudflareBuild ? 'production' : 'local'),
  },
});
