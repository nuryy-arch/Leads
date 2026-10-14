import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  foursquareProvider,
  FOURSQUARE_STORAGE_KEY,
} from './foursquareProvider';
import type { LeadSearchQuery } from './types';
import { KAZAKHSTAN_CITIES } from '../../data/kazakhstanData';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, val: string) => storage.set(key, String(val)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.localStorage = localStorageMock as any;

describe('Foursquare Places Provider', () => {
  const almaty = KAZAKHSTAN_CITIES[0]; // Almaty

  const sampleQuery: LeadSearchQuery = {
    city: almaty,
    categoryQuery: 'Кафе',
    providers: ['FOURSQUARE'],
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('reports isConfigured as false when no key is set', () => {
    expect(foursquareProvider.isConfigured()).toBe(false);
  });

  it('saves and reads API key in localStorage', () => {
    foursquareProvider.saveApiKey('test-fsq-key');
    expect(foursquareProvider.isConfigured()).toBe(true);
    expect(foursquareProvider.getApiKey()).toBe('test-fsq-key');
    expect(localStorage.getItem(FOURSQUARE_STORAGE_KEY)).toBe('test-fsq-key');

    foursquareProvider.removeApiKey();
    expect(foursquareProvider.isConfigured()).toBe(false);
    expect(foursquareProvider.getApiKey()).toBe('');
  });

  it('returns clean error without crashing when API key is missing', async () => {
    const res = await foursquareProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.error).toContain('Отсутствует API-ключ Foursquare Places');
  });

  it('successfully fetches and normalizes Foursquare Places response', async () => {
    foursquareProvider.saveApiKey('mock-valid-fsq-key');

    const mockResponseData = {
      results: [
        {
          fsq_id: 'fsq-123',
          name: 'Traveler’s Coffee Almaty',
          tel: '+7 (727) 261-23-45',
          website: 'travelers-coffee.kz',
          categories: [{ name: 'Кофейня' }],
          location: {
            formatted_address: 'ул. Курмангазы, 43, Алматы',
            address: 'ул. Курмангазы, 43',
          },
          geocodes: {
            main: { latitude: 43.242, longitude: 76.938 },
          },
        },
        {
          fsq_id: 'fsq-456',
          name: 'Неизвестное Кафе',
          location: {
            address: 'Алматы',
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponseData,
    } as any);

    const res = await foursquareProvider.search(sampleQuery);

    expect(res.error).toBeUndefined();
    expect(res.companies).toHaveLength(2);

    const first = res.companies[0];
    expect(first.name).toBe('Traveler’s Coffee Almaty');
    expect(first.category).toBe('Кофейня');
    expect(first.phoneFormatted).toBe('77272612345');
    expect(first.isValidPhone).toBe(true);
    expect(first.websiteStatus).toBe('WEBSITE_LISTED');
    expect(first.websiteUrl).toBe('https://travelers-coffee.kz');
    expect(first.source).toBe('FOURSQUARE');
    expect(first.sources?.[0].confidence).toBe(80);
    expect(first.coordinates).toEqual({ lat: 43.242, lon: 76.938 });

    const second = res.companies[1];
    expect(second.name).toBe('Неизвестное Кафе');
    expect(second.isValidPhone).toBe(false);
    expect(second.websiteStatus).toBe('NO_WEBSITE_LISTED');
    expect(second.websiteUrl).toBeUndefined();
  });

  it('handles HTTP 401 Unauthorized gracefully', async () => {
    foursquareProvider.saveApiKey('invalid-key');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as any);

    const res = await foursquareProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.error).toContain('Неверный API-ключ Foursquare Places (HTTP 401');
  });

  it('handles HTTP 429 Rate Limit gracefully', async () => {
    foursquareProvider.saveApiKey('valid-key-rate-limited');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as any);

    const res = await foursquareProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.error).toContain('Превышен лимит запросов к Foursquare Places API (HTTP 429');
  });

  it('handles network failure gracefully without throwing uncaught exceptions', async () => {
    foursquareProvider.saveApiKey('valid-key');

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection reset'));

    const res = await foursquareProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.error).toContain('Сетевая ошибка Foursquare API');
  });
});
