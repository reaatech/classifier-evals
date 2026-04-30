import { describe, expect, it } from 'vitest';

describe('mcp-server', () => {
  it('exports the server module', async () => {
    const mod = await import('../mcp-server.js');
    expect(mod.server).toBeDefined();
    expect(mod.startMCPServer).toBeDefined();
  });
});
