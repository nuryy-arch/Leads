import type {
  DiscoveredCompany,
  KazakhstanCity,
  SearchProviderId,
} from '../../types';

export interface LeadSearchQuery {
  city: KazakhstanCity;
  categoryQuery: string;
  osmFilter?: string;
  customQuery?: string;
  limit?: number;
  providers: SearchProviderId[];
  forceRefresh?: boolean;
}

export interface ProviderSearchResult {
  companies: DiscoveredCompany[];
  total: number;
  isFromCache?: boolean;
  error?: string;
}

export interface LeadSearchProvider {
  readonly id: SearchProviderId;
  readonly name: string;
  readonly description: string;
  readonly attribution: string;
  readonly requiresApiKey: boolean;
  readonly docsUrl: string;
  readonly pricingNote: string;

  isConfigured(): boolean;
  getApiKey(): string;
  saveApiKey(key: string): void;
  removeApiKey(): void;

  search(
    query: LeadSearchQuery,
    signal?: AbortSignal
  ): Promise<ProviderSearchResult>;
}
