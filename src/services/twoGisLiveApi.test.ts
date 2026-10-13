import { describe, it, expect } from 'vitest';
import { verifyTwoGisApiKey } from './twoGisService';

describe('Real Live 2GIS API Verification', () => {
  it('connects to real live 2GIS server and accurately receives 403 Forbidden on invalid key in meta.code', async () => {
    // Tests real network connectivity to 2GIS production servers
    const response = await fetch('https://catalog.api.2gis.com/3.0/items?q=test&key=dummy_test_key&page_size=1');
    const data = await response.json();

    // 2GIS Catalog API returns JSON containing meta.code = 403
    expect(data?.meta?.code).toBe(403);
    expect(data?.meta?.error?.type).toBe('forbidden');
    expect(data?.meta?.error?.message).toContain('Authorization error');
  });

  it('reports key requirement clearly when testing without an authorized key', async () => {
    const liveKey =
      (typeof process !== 'undefined' ? process.env.VITE_2GIS_API_KEY || process.env.TWOGIS_API_KEY : '') ||
      (import.meta as any).env?.VITE_2GIS_API_KEY ||
      '';
    if (!liveKey) {
      const result = await verifyTwoGisApiKey('');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('API-ключ не указан');
    } else {
      const result = await verifyTwoGisApiKey(liveKey);
      expect(result.isValid).toBe(true);
    }
  });
});
