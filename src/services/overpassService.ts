import type {
  DiscoveredCompany,
  KazakhstanCity,
  WebsiteStatus,
} from '../types';
import { normalizePhoneNumber } from '../utils/whatsapp';

export const OSM_CACHE_KEY = 'osm_lead_cache_v1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CachedQuery {
  timestamp: number;
  fetchedAt: string;
  total: number;
  companies: DiscoveredCompany[];
}

export interface OverpassSearchOptions {
  city: KazakhstanCity;
  categoryQuery: string;
  osmFilter?: string;
  limit?: number;
  forceRefresh?: boolean;
}

export interface OverpassSearchResult {
  total: number;
  companies: DiscoveredCompany[];
  source: 'OSM';
  fetchedAt: string;
  isFromCache: boolean;
  error?: string;
}

// Concurrency lock and rate limiter
let lastRequestTime = 0;
let ongoingRequest: Promise<OverpassSearchResult> | null = null;
const MIN_REQUEST_INTERVAL_MS = 1500;

/**
 * Gets cache from localStorage
 */
function getCachedResults(cacheKey: string): CachedQuery | null {
  try {
    const raw = localStorage.getItem(`${OSM_CACHE_KEY}_${cacheKey}`);
    if (!raw) return null;
    const parsed: CachedQuery = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return parsed;
    }
    localStorage.removeItem(`${OSM_CACHE_KEY}_${cacheKey}`);
  } catch {}
  return null;
}

/**
 * Saves results to localStorage cache
 */
function setCachedResults(
  cacheKey: string,
  companies: DiscoveredCompany[],
  total: number,
  fetchedAt: string
): void {
  try {
    const data: CachedQuery = {
      timestamp: Date.now(),
      fetchedAt,
      total,
      companies,
    };
    localStorage.setItem(`${OSM_CACHE_KEY}_${cacheKey}`, JSON.stringify(data));
  } catch {}
}

/**
 * Determines the primary and mirror endpoints for Overpass
 */
function getOverpassEndpoints(): string[] {
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocal) {
    return [
      '/api/overpass/api/interpreter',
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
  }

  return [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
}

/**
 * Generates an Overpass QL query using the city's bounding box and OSM tags
 */
export function buildOverpassQuery(
  city: KazakhstanCity,
  osmFilter?: string,
  customQuery?: string,
  limit = 40
): string {
  const [south, west, north, east] = city.bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  if (osmFilter && osmFilter.trim()) {
    return `[out:json][timeout:25];
(
  node${osmFilter}["name"](${bboxStr});
  way${osmFilter}["name"](${bboxStr});
);
out center ${limit};`;
  }

  // Fallback for custom search query: match name tag case-insensitively
  const safeQuery = (customQuery || 'бизнес').replace(/["\\]/g, '');
  return `[out:json][timeout:25];
(
  node["name"~"${safeQuery}",i](${bboxStr});
  way["name"~"${safeQuery}",i](${bboxStr});
);
out center ${limit};`;
}

/**
 * Executes a search for businesses via OpenStreetMap Overpass API
 */
export async function searchOverpassCompanies(
  options: OverpassSearchOptions
): Promise<OverpassSearchResult> {
  const { city, categoryQuery, osmFilter, limit = 40, forceRefresh = false } = options;

  const cacheKey = `${city.id}_${osmFilter || categoryQuery}_${limit}`.toLowerCase();

  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedResults(cacheKey);
    if (cached) {
      return {
        total: cached.total,
        companies: cached.companies,
        source: 'OSM',
        fetchedAt: cached.fetchedAt,
        isFromCache: true,
      };
    }
  }

  // Rate limiting & concurrency: avoid parallel flooding of Overpass API
  if (ongoingRequest) {
    try {
      await ongoingRequest;
    } catch {}
  }

  const executionPromise = (async (): Promise<OverpassSearchResult> => {
    // Wait minimum delay since last request
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((res) => setTimeout(res, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();

    const query = buildOverpassQuery(city, osmFilter, categoryQuery, limit);
    const endpoints = getOverpassEndpoints();

    let lastError = 'Источник OpenStreetMap недоступен';

    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          lastError =
            'Сервер OpenStreetMap (Overpass API) временно перегружен (HTTP 429 Too Many Requests). Пожалуйста, подождите 10-15 секунд.';
          continue;
        }

        if (response.status === 504 || response.status === 502) {
          lastError = `Сервер Overpass вернул ошибку тайм-аута (HTTP ${response.status}).`;
          continue;
        }

        if (!response.ok) {
          lastError = `Ошибка сервера Overpass (HTTP ${response.status}: ${response.statusText})`;
          continue;
        }

        const data = await response.json();
        const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];

        const fetchedAt = new Date().toISOString();

        const companies: DiscoveredCompany[] = elements
          .filter((el) => {
            const name = el.tags?.name || el.tags?.['name:ru'] || el.tags?.['name:kz'];
            return Boolean(name && name.trim());
          })
          .map((el) => {
            const tags = el.tags || {};
            const name = (
              tags.name ||
              tags['name:ru'] ||
              tags['name:kz'] ||
              tags['name:en'] ||
              tags.alt_name ||
              'Организация'
            ).trim();

            // Real coordinates from node (lat/lon) or way (center.lat/center.lon)
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            const coordinates =
              typeof lat === 'number' && typeof lon === 'number'
                ? { lat, lon }
                : undefined;

            // Address: only real present tags, never invent
            const street = tags['addr:street'] || tags['addr:place'] || '';
            const house = tags['addr:housenumber'] || '';
            const addressParts = [street, house].filter(Boolean);
            const address = addressParts.length > 0 ? addressParts.join(', ') : '';

            // Phone: only real present tags
            const rawPhone = (
              tags.phone ||
              tags['contact:phone'] ||
              tags['contact:whatsapp'] ||
              tags['contact:mobile'] ||
              tags['phone:mobile'] ||
              ''
            ).trim();

            const phoneCheck = rawPhone
              ? normalizePhoneNumber(rawPhone)
              : { isValid: false, normalized: '', error: 'Телефон не указан в OpenStreetMap' };

            // Website: only real present tags
            const rawWebsite = (
              tags.website ||
              tags['contact:website'] ||
              tags.url ||
              tags['contact:url'] ||
              ''
            ).trim();

            const websiteStatus: WebsiteStatus =
              rawWebsite.length > 0 ? 'WEBSITE_LISTED' : 'NO_WEBSITE_LISTED';

            const websiteUrl = rawWebsite.length > 0 ? formatUrl(rawWebsite) : undefined;

            // Link to object on OpenStreetMap
            const externalUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;

            return {
              id: `osm-${el.type}-${el.id}`,
              name,
              category: determineOsmCategory(tags, categoryQuery),
              city: city.name,
              address: address || `г. ${city.name}`,
              coordinates,
              phoneRaw: rawPhone,
              phoneFormatted: phoneCheck.normalized,
              isValidPhone: phoneCheck.isValid,
              phoneError: phoneCheck.error,
              websiteStatus,
              websiteUrl,
              externalUrl,
              source: 'OSM' as const,
              fetchedAt,
            };
          });

        // Save to cache
        setCachedResults(cacheKey, companies, companies.length, fetchedAt);

        return {
          total: companies.length,
          companies,
          source: 'OSM',
          fetchedAt,
          isFromCache: false,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          lastError = 'Превышен интервал ожидания ответа от зеркала OpenStreetMap (тайм-аут 8 сек).';
        } else {
          lastError = `Сетевая ошибка при обращении к OpenStreetMap: ${err.message || 'Ошибка сети'}`;
        }
      }
    }

    return {
      total: 0,
      companies: [],
      source: 'OSM',
      fetchedAt: new Date().toISOString(),
      isFromCache: false,
      error: lastError,
    };
  })();

  ongoingRequest = executionPromise;
  try {
    return await executionPromise;
  } finally {
    ongoingRequest = null;
  }
}

/**
 * Ensures protocol is included in website URLs
 */
function formatUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Helper to produce human readable category from OSM tags
 */
function determineOsmCategory(tags: Record<string, string>, fallback: string): string {
  if (tags.shop === 'hairdresser' || tags.shop === 'barber') return 'Барбершоп / Парикмахерская';
  if (tags.shop === 'beauty') return 'Салон красоты';
  if (tags.amenity === 'cafe') return 'Кофейня';
  if (tags.shop === 'confectionery' || tags.shop === 'pastry') return 'Кондитерская';
  if (tags.amenity === 'car_wash') return 'Автомойка';
  if (tags.shop === 'clothes') return 'Магазин одежды';
  if (tags.shop === 'florist') return 'Цветочный магазин';
  if (tags.amenity === 'dentist') return 'Стоматология';
  if (tags.leisure === 'fitness_centre') return 'Фитнес-клуб';
  if (tags.amenity === 'spa' || tags.leisure === 'spa') return 'СПА-салон';
  if (tags.amenity === 'restaurant') return 'Ресторан';
  return fallback;
}
