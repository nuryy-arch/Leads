import type { DiscoveredCompany } from '../../types';
import { searchOverpassCompanies } from '../overpassService';
import type { LeadSearchProvider, LeadSearchQuery, ProviderSearchResult } from './types';

export class OverpassProvider implements LeadSearchProvider {
  readonly id = 'OSM' as const;
  readonly name = 'OpenStreetMap (OSM)';
  readonly description = 'Открытые картографические данные через Overpass API: поиск малого бизнеса по тегам OSM';
  readonly attribution = '© OpenStreetMap contributors, ODbL 1.0 (overpass-api.de)';
  readonly requiresApiKey = false;
  readonly docsUrl = 'https://wiki.openstreetmap.org/wiki/Overpass_API';
  readonly pricingNote = '100% бесплатно и без ключа (лимит частоты запросов регулируется автоматически)';

  isConfigured(): boolean {
    return true; // No key required
  }

  getApiKey(): string {
    return '';
  }

  saveApiKey(_key: string): void {}

  removeApiKey(): void {}

  async search(
    query: LeadSearchQuery,
    _signal?: AbortSignal
  ): Promise<ProviderSearchResult> {
    const queryText = query.customQuery?.trim() || query.categoryQuery;

    const response = await searchOverpassCompanies({
      city: query.city,
      categoryQuery: queryText,
      osmFilter: query.osmFilter,
      limit: query.limit || 40,
      forceRefresh: query.forceRefresh,
    });

    if (response.error && response.companies.length === 0) {
      return {
        companies: [],
        total: 0,
        isFromCache: response.isFromCache,
        error: response.error,
      };
    }

    const enriched: DiscoveredCompany[] = response.companies.map((c) => ({
      ...c,
      source: 'OSM' as const,
      sources: [
        {
          sourceId: 'OSM',
          sourceName: 'OpenStreetMap',
          externalId: c.id,
          externalUrl: c.externalUrl,
          fetchedAt: c.fetchedAt,
          originalName: c.name,
          originalAddress: c.address,
          originalCategory: c.category,
          originalPhone: c.phoneRaw,
          originalWebsite: c.websiteUrl,
          confidence: 85,
        },
      ],
    }));

    return {
      companies: enriched,
      total: response.total,
      isFromCache: response.isFromCache,
      error: response.error,
    };
  }
}

export const overpassProvider = new OverpassProvider();
