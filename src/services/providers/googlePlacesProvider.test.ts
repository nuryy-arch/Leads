import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  googlePlacesProvider,
  GOOGLE_PLACES_STORAGE_KEY,
} from './googlePlacesProvider';
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

describe('Google Places Provider', () => {
  const astana = KAZAKHSTAN_CITIES[1]; // Astana

  const sampleQuery: LeadSearchQuery = {
    city: astana,
    categoryQuery: 'Стоматология',
    providers: ['GOOGLE'],
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('reports isConfigured as false when no key is set', () => {
    expect(googlePlacesProvider.isConfigured()).toBe(false);
  });

  it('saves and reads API key in localStorage', () => {
    googlePlacesProvider.saveApiKey('AIzaSyTestKey123');
    expect(googlePlacesProvider.isConfigured()).toBe(true);
    expect(googlePlacesProvider.getApiKey()).toBe('AIzaSyTestKey123');
    expect(localStorage.getItem(GOOGLE_PLACES_STORAGE_KEY)).toBe('AIzaSyTestKey123');

    googlePlacesProvider.removeApiKey();
    expect(googlePlacesProvider.isConfigured()).toBe(false);
    expect(googlePlacesProvider.getApiKey()).toBe('');
  });

  it('returns clean error when API key is missing', async () => {
    const res = await googlePlacesProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.error).toContain('Отсутствует API-ключ Google Places');
  });

  it('successfully fetches and normalizes Google Places response', async () => {
    googlePlacesProvider.saveApiKey('mock-google-key');

    const mockResponseData = {
      places: [
        {
          id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
          displayName: { text: 'Стоматологическая клиника Dental Park' },
          formattedAddress: 'ул. Достык, 13, Астана, Казахстан',
          internationalPhoneNumber: '+7 717 255-00-11',
          nationalPhoneNumber: '8 (7172) 55-00-11',
          websiteUri: 'https://dentalpark.kz',
          primaryTypeDisplayName: { text: 'Стоматологическая клиника' },
          location: { latitude: 51.128, longitude: 71.430 },
          googleMapsUri: 'https://maps.google.com/?cid=12345',
        },
        {
          id: 'ChIJw8v_test456',
          displayName: { text: 'Клиника Без Телефона' },
          formattedAddress: 'Астана, Казахстан',
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponseData,
    } as any);

    const res = await googlePlacesProvider.search(sampleQuery);

    expect(res.error).toBeUndefined();
    expect(res.companies).toHaveLength(2);

    const first = res.companies[0];
    expect(first.name).toBe('Стоматологическая клиника Dental Park');
    expect(first.category).toBe('Стоматологическая клиника');
    expect(first.phoneFormatted).toBe('77172550011');
    expect(first.isValidPhone).toBe(true);
    expect(first.websiteStatus).toBe('WEBSITE_LISTED');
    expect(first.websiteUrl).toBe('https://dentalpark.kz');
    expect(first.source).toBe('GOOGLE');
    expect(first.sources?.[0].confidence).toBe(90);
    expect(first.coordinates).toEqual({ lat: 51.128, lon: 71.430 });
    expect(first.externalUrl).toBe('https://maps.google.com/?cid=12345');

    const second = res.companies[1];
    expect(second.name).toBe('Клиника Без Телефона');
    expect(second.isValidPhone).toBe(false);
    expect(second.websiteStatus).toBe('NO_WEBSITE_LISTED');
  });

  it('handles HTTP 403 Forbidden with clean API error details', async () => {
    googlePlacesProvider.saveApiKey('invalid-google-key');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: 'API keys with referer restrictions cannot be used with this API' },
      }),
    } as any);

    const res = await googlePlacesProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.error).toContain('API keys with referer restrictions cannot be used');
  });

  it('handles HTTP 429 Quota Exceeded gracefully', async () => {
    googlePlacesProvider.saveApiKey('rate-limited-key');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as any);

    const res = await googlePlacesProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.error).toContain('Превышен лимит запросов к Google Places API (HTTP 429');
  });

  it('handles network failure gracefully without throwing uncaught exceptions', async () => {
    googlePlacesProvider.saveApiKey('valid-key');

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));

    const res = await googlePlacesProvider.search(sampleQuery);
    expect(res.companies).toHaveLength(0);
    expect(res.error).toContain('Сетевая ошибка Google Places API');
  });
});
