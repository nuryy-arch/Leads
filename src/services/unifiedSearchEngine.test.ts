import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unifiedSearchEngine } from './unifiedSearchEngine';
import { SEARCH_PROVIDERS } from './providers';
import type { KazakhstanCity } from '../types';

const mockCity: KazakhstanCity = {
  id: 'almaty',
  name: 'Алматы',
  nameKz: 'Алматы',
  regionId: 67,
  bbox: [43.1, 76.8, 43.4, 77.1],
  lat: 43.238949,
  lon: 76.945465,
};

describe('UnifiedLeadSearchEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles empty results from all providers gracefully', async () => {
    vi.spyOn(SEARCH_PROVIDERS['2GIS'], 'isConfigured').mockReturnValue(true);
    vi.spyOn(SEARCH_PROVIDERS['2GIS'], 'search').mockResolvedValue({
      companies: [],
      total: 0,
    });

    vi.spyOn(SEARCH_PROVIDERS['OSM'], 'search').mockResolvedValue({
      companies: [],
      total: 0,
    });

    const result = await unifiedSearchEngine.searchAll(
      {
        city: mockCity,
        categoryQuery: 'несуществующая_ниша_123',
        providers: ['2GIS', 'OSM'],
      },
      []
    );

    expect(result.companies).toEqual([]);
    expect(result.totalUniqueFound).toBe(0);
    expect(result.hasErrors).toBe(false);
    expect(result.providerStatuses).toHaveLength(2);
    expect(result.providerStatuses.every((s) => s.status === 'empty')).toBe(true);
  });

  it('survives partial failure when one provider fails and another succeeds', async () => {
    vi.spyOn(SEARCH_PROVIDERS['2GIS'], 'isConfigured').mockReturnValue(true);
    vi.spyOn(SEARCH_PROVIDERS['2GIS'], 'search').mockRejectedValue(
      new Error('2GIS service timeout 504')
    );

    vi.spyOn(SEARCH_PROVIDERS['OSM'], 'search').mockResolvedValue({
      companies: [
        {
          id: 'osm-1',
          name: 'OSM Салон',
          category: 'beauty',
          city: 'Алматы',
          address: 'Абая, 10',
          phoneRaw: '77011112233',
          phoneFormatted: '77011112233',
          isValidPhone: true,
          websiteStatus: 'NO_WEBSITE_LISTED',
          source: 'OSM',
          fetchedAt: '2026-10-13T10:00:00Z',
        },
      ],
      total: 1,
    });

    const result = await unifiedSearchEngine.searchAll(
      {
        city: mockCity,
        categoryQuery: 'салон',
        providers: ['2GIS', 'OSM'],
      },
      []
    );

    expect(result.isPartial).toBe(true);
    expect(result.hasErrors).toBe(true);
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe('OSM Салон');

    const status2Gis = result.providerStatuses.find((s) => s.providerId === '2GIS');
    const statusOsm = result.providerStatuses.find((s) => s.providerId === 'OSM');

    expect(status2Gis?.status).toBe('error');
    expect(status2Gis?.error).toContain('2GIS service timeout 504');
    expect(statusOsm?.status).toBe('success');
  });

  it('marks unconfigured provider as not_configured without throwing', async () => {
    vi.spyOn(SEARCH_PROVIDERS['FOURSQUARE'], 'isConfigured').mockReturnValue(false);

    vi.spyOn(SEARCH_PROVIDERS['OSM'], 'search').mockResolvedValue({
      companies: [],
      total: 0,
    });

    const result = await unifiedSearchEngine.searchAll(
      {
        city: mockCity,
        categoryQuery: 'кофейня',
        providers: ['OSM', 'FOURSQUARE'],
      },
      []
    );

    const fsqStatus = result.providerStatuses.find((s) => s.providerId === 'FOURSQUARE');
    expect(fsqStatus?.status).toBe('not_configured');
    expect(fsqStatus?.error).toBeDefined();
  });

  it('aborts previous search when cancelCurrentSearch is triggered', async () => {
    vi.spyOn(SEARCH_PROVIDERS['OSM'], 'search').mockImplementation(
      (_query: any, signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({ companies: [], total: 0 });
          }, 500);

          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }
        })
    );

    const promise = unifiedSearchEngine.searchAll(
      {
        city: mockCity,
        categoryQuery: 'автомойка',
        providers: ['OSM'],
      },
      []
    );

    unifiedSearchEngine.cancelCurrentSearch();

    await expect(promise).rejects.toThrow();
  });
});
