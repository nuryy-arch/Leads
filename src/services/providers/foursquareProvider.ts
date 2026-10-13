import type { DiscoveredCompany, WebsiteStatus } from '../../types';
import { normalizePhoneNumber } from '../../utils/whatsapp';
import type { LeadSearchProvider, LeadSearchQuery, ProviderSearchResult } from './types';

export const FOURSQUARE_STORAGE_KEY = 'foursquare_api_key_v1';

export class FoursquarePlacesProvider implements LeadSearchProvider {
  readonly id = 'FOURSQUARE' as const;
  readonly name = 'Foursquare Places';
  readonly description = 'Глобальная база заведений и организаций Foursquare: кафе, салоны, сервисы с контактами в Казахстане';
  readonly attribution = 'Data powered by Foursquare Places API';
  readonly requiresApiKey = true;
  readonly docsUrl = 'https://location.foursquare.com/developer/';
  readonly pricingNote = 'Free tier: $200 бесплатного кредита в месяц (до 50 000 вызовов Places API)';

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  getApiKey(): string {
    try {
      const saved = localStorage.getItem(FOURSQUARE_STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {}

    const envKey = (import.meta as any).env?.VITE_FOURSQUARE_API_KEY;
    if (typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
    return '';
  }

  saveApiKey(key: string): void {
    try {
      if (key.trim()) {
        localStorage.setItem(FOURSQUARE_STORAGE_KEY, key.trim());
      } else {
        localStorage.removeItem(FOURSQUARE_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save Foursquare key', e);
    }
  }

  removeApiKey(): void {
    try {
      localStorage.removeItem(FOURSQUARE_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to remove Foursquare key', e);
    }
  }

  async search(
    query: LeadSearchQuery,
    signal?: AbortSignal
  ): Promise<ProviderSearchResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        companies: [],
        total: 0,
        error: 'Отсутствует API-ключ Foursquare Places. Укажите ключ в настройках (Settings).',
      };
    }

    const queryText = query.customQuery?.trim() || query.categoryQuery;
    const limit = Math.min(query.limit || 40, 50);

    const params = new URLSearchParams();
    params.set('near', `${query.city.name}, Kazakhstan`);
    params.set('query', queryText);
    params.set('limit', String(limit));
    params.set('fields', 'fsq_id,name,location,tel,website,categories,geocodes,link');

    const url = `https://api.foursquare.com/v3/places/search?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: apiKey,
        },
        signal,
      });

      if (response.status === 401) {
        return {
          companies: [],
          total: 0,
          error: 'Неверный API-ключ Foursquare Places (HTTP 401 Unauthorized). Проверьте ключ в настройках.',
        };
      }

      if (response.status === 429) {
        return {
          companies: [],
          total: 0,
          error: 'Превышен лимит запросов к Foursquare Places API (HTTP 429 Rate Limit). Попробуйте позже.',
        };
      }

      if (!response.ok) {
        return {
          companies: [],
          total: 0,
          error: `Ошибка Foursquare API (HTTP ${response.status}: ${response.statusText})`,
        };
      }

      const data = await response.json();
      const results: any[] = Array.isArray(data?.results) ? data.results : [];

      const fetchedAt = new Date().toISOString();

      const companies: DiscoveredCompany[] = results.map((item: any) => {
        const rawPhone = item.tel || '';
        const phoneCheck = rawPhone
          ? normalizePhoneNumber(rawPhone)
          : { isValid: false, normalized: '', error: 'Номер телефона не указан' };

        const websiteUrl = item.website || '';
        const websiteStatus: WebsiteStatus =
          websiteUrl && websiteUrl.trim().length > 0
            ? 'WEBSITE_LISTED'
            : 'NO_WEBSITE_LISTED';

        const category =
          item.categories?.[0]?.name || query.categoryQuery;

        const address =
          item.location?.formatted_address ||
          item.location?.address ||
          `${query.city.name}`;

        const coords = item.geocodes?.main
          ? { lat: item.geocodes.main.latitude, lon: item.geocodes.main.longitude }
          : undefined;

        const externalUrl = item.fsq_id
          ? `https://foursquare.com/v/${item.fsq_id}`
          : undefined;

        return {
          id: `fsq-${item.fsq_id || Math.random().toString(36).substring(2, 9)}`,
          name: item.name || 'Организация',
          category,
          city: query.city.name,
          address,
          coordinates: coords,
          phoneRaw: rawPhone,
          phoneFormatted: phoneCheck.normalized,
          isValidPhone: phoneCheck.isValid,
          phoneError: phoneCheck.error,
          websiteStatus,
          websiteUrl: websiteUrl ? normalizeWebsiteUrl(websiteUrl) : undefined,
          externalUrl,
          source: 'FOURSQUARE' as const,
          sources: [
            {
              sourceId: 'FOURSQUARE',
              sourceName: 'Foursquare Places',
              externalId: item.fsq_id,
              externalUrl,
              fetchedAt,
              originalName: item.name,
              originalAddress: address,
              originalCategory: category,
              originalPhone: rawPhone,
              originalWebsite: websiteUrl,
              confidence: 80,
            },
          ],
          fetchedAt,
        };
      });

      return {
        companies,
        total: companies.length,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      return {
        companies: [],
        total: 0,
        error: `Сетевая ошибка Foursquare API: ${err.message || 'Не удалось связаться с сервером'}`,
      };
    }
  }
}

function normalizeWebsiteUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const foursquareProvider = new FoursquarePlacesProvider();
