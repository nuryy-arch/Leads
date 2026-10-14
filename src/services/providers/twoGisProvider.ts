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
    signal?: AbortSignal
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
    const requestedLimit = query.limit || 100;

    // Handle "All Kazakhstan" search (regionId === 0 or id === 'all_kz')
    if (query.city.id === 'all_kz' || query.city.regionId === 0) {
      return this.searchAllKazakhstan(apiKey, queryText, requestedLimit, signal);
    }

    // Single city: fetch up to 10 requests (5 pages default sort + 5 pages name sort)
    // to get up to 100 unique real leads within 2GIS Platform/Demo limit constraints
    return this.searchSingleCity(
      apiKey,
      query.city.name,
      query.city.regionId,
      queryText,
      requestedLimit,
      signal
    );
  }

  private async searchSingleCity(
    apiKey: string,
    cityName: string,
    regionId: number | undefined,
    queryText: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<ProviderSearchResult> {
    // If user only requested 10 or fewer, a single request is sufficient
    if (limit <= 10) {
      const response = await searchTwoGisCompanies({
        apiKey,
        cityName,
        regionId,
        query: queryText,
        pageSize: 10,
        page: 1,
      });

      return {
        companies: this.enrichCompanies(response.companies),
        total: response.total,
        error: response.error,
      };
    }

    // Multi-page fetch: 10 requests total
    // 5 pages relevance + 5 pages sort by name
    const requestTasks: Array<{ page: number; sort?: string }> = [
      { page: 1 },
      { page: 2 },
      { page: 3 },
      { page: 4 },
      { page: 5 },
      { page: 1, sort: 'name' },
      { page: 2, sort: 'name' },
      { page: 3, sort: 'name' },
      { page: 4, sort: 'name' },
      { page: 5, sort: 'name' },
    ];

    const companiesMap = new Map<string, DiscoveredCompany>();
    let maxReportedTotal = 0;
    let firstError: string | undefined;

    const promises = requestTasks.map(async (task) => {
      if (signal?.aborted) return;
      try {
        const res = await searchTwoGisCompanies({
          apiKey,
          cityName,
          regionId,
          query: queryText,
          pageSize: 10,
          page: task.page,
          sort: task.sort,
        });

        if (res.total > maxReportedTotal) {
          maxReportedTotal = res.total;
        }

        if (res.error && !firstError) {
          firstError = res.error;
        }

        for (const company of res.companies) {
          if (!companiesMap.has(company.id)) {
            companiesMap.set(company.id, company);
          }
        }
      } catch (err: any) {
        if (!firstError) firstError = err?.message;
      }
    });

    await Promise.all(promises);

    const allCompanies = Array.from(companiesMap.values()).slice(0, limit);

    return {
      companies: this.enrichCompanies(allCompanies),
      total: Math.max(maxReportedTotal, allCompanies.length),
      error: allCompanies.length === 0 ? firstError : undefined,
    };
  }

  private async searchAllKazakhstan(
    apiKey: string,
    queryText: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<ProviderSearchResult> {
    // Kazakhstan's key economic centers with confirmed 2GIS region_ids
    const majorCities = [
      { name: 'Алматы', regionId: 68 },
      { name: 'Астана', regionId: 118 },
      { name: 'Шымкент', regionId: 162 },
      { name: 'Караганда', regionId: 116 },
      { name: 'Усть-Каменогорск', regionId: 115 },
      { name: 'Атырау', regionId: 161 },
      { name: 'Кокшетау', regionId: 167 },
      { name: 'Актау', regionId: 158 },
      { name: 'Костанай', regionId: 160 },
      { name: 'Кызылорда', regionId: 185 },
    ];

    const companiesMap = new Map<string, DiscoveredCompany>();
    let aggregatedTotal = 0;
    let firstError: string | undefined;

    // Distribute pages across the major cities
    const cityPromises = majorCities.map(async (city) => {
      if (signal?.aborted) return;
      try {
        // Fetch up to 2 pages (20 companies) per major city
        const p1 = await searchTwoGisCompanies({
          apiKey,
          cityName: city.name,
          regionId: city.regionId,
          query: queryText,
          pageSize: 10,
          page: 1,
        });

        if (p1.total) aggregatedTotal += p1.total;
        if (p1.error && !firstError) firstError = p1.error;

        for (const c of p1.companies) {
          companiesMap.set(c.id, c);
        }

        // If limit is large (e.g. 100+), fetch page 2 as well
        if (limit > 50 && !signal?.aborted) {
          const p2 = await searchTwoGisCompanies({
            apiKey,
            cityName: city.name,
            regionId: city.regionId,
            query: queryText,
            pageSize: 10,
            page: 2,
          });
          for (const c of p2.companies) {
            companiesMap.set(c.id, c);
          }
        }
      } catch (err: any) {
        if (!firstError) firstError = err?.message;
      }
    });

    await Promise.all(cityPromises);

    const allCompanies = Array.from(companiesMap.values()).slice(0, limit);

    return {
      companies: this.enrichCompanies(allCompanies),
      total: Math.max(aggregatedTotal, allCompanies.length),
      error: allCompanies.length === 0 ? firstError : undefined,
    };
  }

  private enrichCompanies(companies: DiscoveredCompany[]): DiscoveredCompany[] {
    return companies.map((c) => ({
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
  }
}

export const twoGisProvider = new TwoGisProvider();
