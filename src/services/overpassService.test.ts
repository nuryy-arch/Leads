import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildOverpassQuery,
  searchOverpassCompanies,
} from './overpassService';
import { convertDiscoveredToLead, isDuplicateLead } from '../utils/leadManagement';
import { KAZAKHSTAN_CITIES } from '../data/kazakhstanData';
import type { BusinessLead, DiscoveredCompany } from '../types';

describe('OpenStreetMap Overpass Service', () => {
  const almatyCity = KAZAKHSTAN_CITIES.find((c) => c.id === 'almaty')!;

  const memoryStore: Record<string, string> = {};
  const mockStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, val: string) => { memoryStore[key] = String(val); },
    removeItem: (key: string) => { delete memoryStore[key]; },
    clear: () => { Object.keys(memoryStore).forEach((k) => delete memoryStore[k]); },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).localStorage = mockStorage;
    mockStorage.clear();
  });

  it('builds an efficient bounded Overpass QL query with city bbox and filter', () => {
    const query = buildOverpassQuery(
      almatyCity,
      '["shop"="hairdresser"]',
      'барбершоп',
      30
    );

    expect(query).toContain('[out:json][timeout:25];');
    expect(query).toContain('node["shop"="hairdresser"]["name"]');
    expect(query).toContain('way["shop"="hairdresser"]["name"]');
    // Checks that Almaty bounding box is included
    expect(query).toContain(almatyCity.bbox.join(','));
    expect(query).toContain('out center 30;');
  });

  it('correctly parses raw OSM elements: extracts real coordinates, addresses, and respects missing fields', async () => {
    // Mock Overpass server response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 101,
            lat: 43.25,
            lon: 76.94,
            tags: {
              name: 'Barbershop Chop-Chop',
              shop: 'hairdresser',
              phone: '+7 777 123-45-67',
              website: 'https://chopchop.kz',
              'addr:street': 'ул. Достык',
              'addr:housenumber': '15',
            },
          },
          {
            type: 'node',
            id: 102,
            lat: 43.26,
            lon: 76.95,
            tags: {
              name: 'Парикмахерская Сауле',
              shop: 'hairdresser',
              // Notice: NO phone, NO website, NO street
            },
          },
          {
            type: 'node',
            id: 103,
            lat: 43.27,
            lon: 76.96,
            tags: {
              // Anonymous node without name: must be filtered out
              shop: 'hairdresser',
            },
          },
        ],
      }),
    } as any);

    const result = await searchOverpassCompanies({
      city: almatyCity,
      categoryQuery: 'барбершоп',
      osmFilter: '["shop"="hairdresser"]',
      limit: 10,
    });

    expect(result.error).toBeUndefined();
    expect(result.source).toBe('OSM');
    expect(result.companies).toHaveLength(2); // Anonymous node 103 was excluded

    // Check item 1 with full data
    const item1 = result.companies[0];
    expect(item1.name).toBe('Barbershop Chop-Chop');
    expect(item1.coordinates).toEqual({ lat: 43.25, lon: 76.94 });
    expect(item1.phoneRaw).toBe('+7 777 123-45-67');
    expect(item1.phoneFormatted).toBe('77771234567');
    expect(item1.isValidPhone).toBe(true);
    expect(item1.websiteStatus).toBe('WEBSITE_LISTED');
    expect(item1.websiteUrl).toBe('https://chopchop.kz');
    expect(item1.address).toBe('ул. Достык, 15');
    expect(item1.externalUrl).toBe('https://www.openstreetmap.org/node/101');
    expect(item1.source).toBe('OSM');
    expect(item1.fetchedAt).toBeDefined();

    // Check item 2 with missing phone and website (NO invent rule!)
    const item2 = result.companies[1];
    expect(item2.name).toBe('Парикмахерская Сауле');
    expect(item2.phoneRaw).toBe('');
    expect(item2.isValidPhone).toBe(false);
    expect(item2.websiteStatus).toBe('NO_WEBSITE_LISTED');
    expect(item2.websiteUrl).toBeUndefined();
    expect(item2.externalUrl).toBe('https://www.openstreetmap.org/node/102');
  });

  it('caches results and avoids duplicate network hits when called with same parameters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 201,
            lat: 43.25,
            lon: 76.94,
            tags: { name: 'Кофейня Traveler', amenity: 'cafe' },
          },
        ],
      }),
    } as any);

    // Call 1: hits network
    const res1 = await searchOverpassCompanies({
      city: almatyCity,
      categoryQuery: 'кофейня',
      osmFilter: '["amenity"="cafe"]',
    });
    expect(res1.isFromCache).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Call 2: served from cache
    const res2 = await searchOverpassCompanies({
      city: almatyCity,
      categoryQuery: 'кофейня',
      osmFilter: '["amenity"="cafe"]',
    });
    expect(res2.isFromCache).toBe(true);
    expect(res2.companies[0].name).toBe('Кофейня Traveler');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // network was not called again!
  });

  it('handles HTTP 429 Too Many Requests with a clear error message and no fake data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as any);

    const result = await searchOverpassCompanies({
      city: almatyCity,
      categoryQuery: 'автомойка',
      forceRefresh: true,
    });

    expect(result.companies).toHaveLength(0);
    expect(result.error).toContain('429');
    expect(result.error).toContain('перегружен');
  });

  it('converts OSM discovered company to BusinessLead with IMPORTED_FROM_OSM event and deduplication', () => {
    const osmCompany: DiscoveredCompany = {
      id: 'osm-node-555',
      name: 'Nail Studio Астана',
      category: 'Салон красоты',
      city: 'Астана',
      address: 'пр. Кабанбай Батыра, 12',
      coordinates: { lat: 51.13, lon: 71.42 },
      phoneRaw: '+7 701 444-55-66',
      phoneFormatted: '77014445566',
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      externalUrl: 'https://www.openstreetmap.org/node/555',
      source: 'OSM',
      fetchedAt: new Date().toISOString(),
    };

    const lead = convertDiscoveredToLead(osmCompany, 'ru');
    expect(lead.source).toBe('OSM');
    expect(lead.coordinates).toEqual({ lat: 51.13, lon: 71.42 });
    expect(lead.history[0].type).toBe('IMPORTED_FROM_OSM');
    expect(lead.history[0].description).toContain('OpenStreetMap');

    // Deduplication check
    const existing: BusinessLead[] = [lead];
    expect(isDuplicateLead(osmCompany, existing)).toBe(true);
  });
});
