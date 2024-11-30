import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      // an example of file based convention,
      // you don't have to follow it
      include: ['src/test/node/*.test.ts'],
      name: 'node',
      environment: 'node',
    },
  },
  {
    test: {
      setupFiles: ['./src/test/browser/setup.ts', 'vitest-browser-react'],
      // an example of file based convention,
      // you don't have to follow it
      include: ['src/test/browser/*.test.tsx'],
      name: 'browser',
      browser: {
        enabled: true,
        name: 'chromium',
        provider: 'playwright',
      },
    },
  },
])
