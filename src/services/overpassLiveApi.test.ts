import { describe, it, expect } from 'vitest';
import { searchOverpassCompanies } from './overpassService';
import { KAZAKHSTAN_CITIES, BUSINESS_CATEGORIES } from '../data/kazakhstanData';

describe('Real Live OpenStreetMap Overpass API Verification', () => {
  it('performs a real live request for cafes in Almaty and parses real OSM objects', async () => {
    const almaty = KAZAKHSTAN_CITIES.find((c) => c.id === 'almaty')!;
    const cafeCategory = BUSINESS_CATEGORIES.find((c) => c.id === 'coffee_shop')!;

    // Perform real live request with limit of 5 items
    const result = await searchOverpassCompanies({
      city: almaty,
      categoryQuery: cafeCategory.query,
      osmFilter: cafeCategory.osmFilter,
      limit: 5,
      forceRefresh: true,
    });

    if (result.error) {
      // If public Overpass is momentarily overloaded/rate limited, it must report a clear error
      expect(typeof result.error).toBe('string');
      expect(result.companies).toHaveLength(0);
    } else {
      expect(result.source).toBe('OSM');
      expect(Array.isArray(result.companies)).toBe(true);
      expect(result.companies.length).toBeGreaterThan(0);

      const first = result.companies[0];
      expect(first.name).toBeDefined();
      expect(first.name.trim().length).toBeGreaterThan(0);
      expect(first.city).toBe('Алматы');
      expect(first.externalUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|way)\/\d+$/);

      // Verify that if phone or website is missing, it is not fabricated
      if (!first.phoneRaw) {
        expect(first.isValidPhone).toBe(false);
      }
      if (first.websiteStatus === 'NO_WEBSITE_LISTED') {
        expect(first.websiteUrl).toBeUndefined();
      }
    }
  }, 30000); // 30s timeout for live network test
});
