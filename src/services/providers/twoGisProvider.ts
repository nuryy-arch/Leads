import type { DiscoveredCompany } from '../../types';
import {
  searchTwoGisCompanies,
  getStoredTwoGisApiKey,
  saveTwoGisApiKey,
  removeTwoGisApiKey,
} from '../twoGisService';
import type { LeadSearchProvider, LeadSearchQuery, ProviderSearchResult } from './types';

export class TwoGisProvider implements LeadSearchProvider {
  readonly id = '2GIS' as const;
  readonly name = '2GIS (2ГИС)';
  readonly description = 'Официальный Каталог 2ГИС: актуальные номера телефонов, адреса и филиалы городов Казахстана';
  readonly attribution = 'Данные предоставлены 2ГИС (dev.2gis.kz)';
  readonly requiresApiKey = true;
  readonly docsUrl = 'https://dev.2gis.kz/';
  readonly pricingNote = 'Бесплатный демо-доступ или коммерческий тариф по договору';

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  getApiKey(): string {
    return getStoredTwoGisApiKey();
  }

  saveApiKey(key: string): void {
    saveTwoGisApiKey(key);
  }

  removeApiKey(): void {
    removeTwoGisApiKey();
  }

  async search(
    query: LeadSearchQuery,
    _signal?: AbortSignal
  ): Promise<ProviderSearchResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        companies: [],
        total: 0,
        error: 'Отсутствует API-ключ 2GIS. Укажите ключ в настройках поиска.',
      };
    }

    const queryText = query.customQuery?.trim() || query.categoryQuery;

    const response = await searchTwoGisCompanies({
      apiKey,
      cityName: query.city.name,
      regionId: query.city.regionId,
      query: queryText,
      pageSize: query.limit || 50,
      page: 1,
    });

    if (response.error && response.companies.length === 0) {
      return {
        companies: [],
        total: 0,
        error: response.error,
      };
    }

    const enriched: DiscoveredCompany[] = response.companies.map((c) => ({
      ...c,
      source: '2GIS' as const,
      sources: [
        {
          sourceId: '2GIS',
          sourceName: '2GIS',
          externalId: c.id,
          externalUrl: c.externalUrl,
          fetchedAt: c.fetchedAt,
          originalName: c.name,
          originalAddress: c.address,
          originalCategory: c.category,
          originalPhone: c.phoneRaw,
          originalWebsite: c.websiteUrl,
          confidence: 95,
        },
      ],
    }));

    return {
      companies: enriched,
      total: response.total,
      error: response.error,
    };
  }
}

export const twoGisProvider = new TwoGisProvider();
