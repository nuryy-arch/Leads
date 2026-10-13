import type { SearchProviderId } from '../../types';
import type { LeadSearchProvider } from './types';
import { twoGisProvider } from './twoGisProvider';
import { overpassProvider } from './overpassProvider';
import { foursquareProvider } from './foursquareProvider';
import { googlePlacesProvider } from './googlePlacesProvider';

export * from './types';
export * from './twoGisProvider';
export * from './overpassProvider';
export * from './foursquareProvider';
export * from './googlePlacesProvider';

export const SEARCH_PROVIDERS: Record<SearchProviderId, LeadSearchProvider> = {
  '2GIS': twoGisProvider,
  OSM: overpassProvider,
  FOURSQUARE: foursquareProvider,
  GOOGLE: googlePlacesProvider,
};

export const ALL_PROVIDER_IDS: SearchProviderId[] = ['2GIS', 'OSM', 'FOURSQUARE', 'GOOGLE'];

export function getProvider(id: SearchProviderId): LeadSearchProvider {
  const provider = SEARCH_PROVIDERS[id];
  if (!provider) {
    throw new Error(`Неизвестный провайдер поиска: ${id}`);
  }
  return provider;
}
