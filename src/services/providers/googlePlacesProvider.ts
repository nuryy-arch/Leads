import type { DiscoveredCompany, WebsiteStatus } from '../../types';
import { normalizePhoneNumber } from '../../utils/whatsapp';
import type { LeadSearchProvider, LeadSearchQuery, ProviderSearchResult } from './types';

export const GOOGLE_PLACES_STORAGE_KEY = 'google_places_api_key_v1';

export class GooglePlacesProvider implements LeadSearchProvider {
  readonly id = 'GOOGLE' as const;
  readonly name = 'Google Places (New)';
  readonly description = 'Официальный поиск Google Places API (Text Search): детальные карточки заведений и компаний';
  readonly attribution = 'Data © Google Maps Platform (places.googleapis.com)';
  readonly requiresApiKey = true;
  readonly docsUrl = 'https://developers.google.com/maps/documentation/places/web-service/text-search';
  readonly pricingNote = 'Google Maps Platform: $200/мес бесплатный лимит в Google Cloud Console (требуется привязка биллинга)';

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  getApiKey(): string {
    try {
      const saved = localStorage.getItem(GOOGLE_PLACES_STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {}

    const envKey = (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY;
    if (typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
    return '';
  }

  saveApiKey(key: string): void {
    try {
      if (key.trim()) {
        localStorage.setItem(GOOGLE_PLACES_STORAGE_KEY, key.trim());
      } else {
        localStorage.removeItem(GOOGLE_PLACES_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save Google Places key', e);
    }
  }

  removeApiKey(): void {
    try {
      localStorage.removeItem(GOOGLE_PLACES_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to remove Google Places key', e);
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
        error: 'Отсутствует API-ключ Google Places. Добавьте ключ в настройках (Settings), если подключен Google Cloud.',
      };
    }

    const queryText = query.customQuery?.trim() || query.categoryQuery;
    const limit = Math.min(query.limit || 20, 20);

    const url = 'https://places.googleapis.com/v1/places:searchText';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.location,places.googleMapsUri',
        },
        body: JSON.stringify({
          textQuery: `${queryText} in ${query.city.name}, Kazakhstan`,
          pageSize: limit,
          languageCode: 'ru',
        }),
        signal,
      });

      if (response.status === 400 || response.status === 403) {
        const errorData = await response.json().catch(() => null);
        const msg = errorData?.error?.message || `Ошибка авторизации Google Places API (HTTP ${response.status})`;
        return {
          companies: [],
          total: 0,
          error: msg,
        };
      }

      if (response.status === 429) {
        return {
          companies: [],
          total: 0,
          error: 'Превышен лимит запросов к Google Places API (HTTP 429 Quota Exceeded).',
        };
      }

      if (!response.ok) {
        return {
          companies: [],
          total: 0,
          error: `Google Places API вернул ошибку (HTTP ${response.status}: ${response.statusText})`,
        };
      }

      const data = await response.json();
      const places: any[] = Array.isArray(data?.places) ? data.places : [];

      const fetchedAt = new Date().toISOString();

      const companies: DiscoveredCompany[] = places.map((place: any) => {
        const name = place.displayName?.text || 'Организация';
        const rawPhone =
          place.internationalPhoneNumber ||
          place.nationalPhoneNumber ||
          '';

        const phoneCheck = rawPhone
          ? normalizePhoneNumber(rawPhone)
          : { isValid: false, normalized: '', error: 'Номер телефона не указан' };

        const websiteUrl = place.websiteUri || '';
        const websiteStatus: WebsiteStatus =
          websiteUrl && websiteUrl.trim().length > 0
            ? 'WEBSITE_LISTED'
            : 'NO_WEBSITE_LISTED';

        const category =
          place.primaryTypeDisplayName?.text || query.categoryQuery;

        const address =
          place.formattedAddress || `${query.city.name}`;

        const coords = place.location
          ? { lat: place.location.latitude, lon: place.location.longitude }
          : undefined;

        const externalUrl = place.googleMapsUri || undefined;

        return {
          id: `gplaces-${place.id || Math.random().toString(36).substring(2, 9)}`,
          name,
          category,
          city: query.city.name,
          address,
          coordinates: coords,
          phoneRaw: rawPhone,
          phoneFormatted: phoneCheck.normalized,
          isValidPhone: phoneCheck.isValid,
          phoneError: phoneCheck.error,
          websiteStatus,
          websiteUrl: websiteUrl || undefined,
          externalUrl,
          source: 'GOOGLE' as const,
          sources: [
            {
              sourceId: 'GOOGLE',
              sourceName: 'Google Places',
              externalId: place.id,
              externalUrl,
              fetchedAt,
              originalName: name,
              originalAddress: address,
              originalCategory: category,
              originalPhone: rawPhone,
              originalWebsite: websiteUrl,
              confidence: 90,
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
        error: `Сетевая ошибка Google Places API: ${err.message || 'Не удалось связаться с сервером'}`,
      };
    }
  }
}

export const googlePlacesProvider = new GooglePlacesProvider();
