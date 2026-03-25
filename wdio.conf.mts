import type { ObsidianCapability } from 'wdio-obsidian-service';

const capabilities: ObsidianCapability[] = [
  {
    browserName: 'obsidian',
    browserVersion: 'latest',
    'wdio:obsidianOptions': {
      plugins: ['.'],
      vault: './e2e/vault',
    },
  },
];

export const config = {
  runner: 'local',
  specs: ['./e2e/specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities,
  framework: 'mocha',
  services: ['obsidian'],
  reporters: ['spec', ['obsidian', {}]],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60_000,
  },
  logLevel: 'warn',
};
