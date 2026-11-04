import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Строгая CSP только в сборке: в dev Vite вставляет inline-код для HMR.
const csp: Plugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "base-uri 'self'",
      "form-action 'none'",
      "object-src 'none'",
    ].join('; ');
    return html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
    );
  },
};

export default defineConfig({
  base: './',
  plugins: [react(), csp],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
