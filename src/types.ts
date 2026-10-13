export type LeadStatus =
  | 'NEW'
  | 'LINK_OPENED'
  | 'SENT'
  | 'INTERESTED'
  | 'REJECTED'
  | 'DO_NOT_CONTACT';

export type Language = 'ru' | 'kz';

export type WebsiteStatus =
  | 'WEBSITE_LISTED'
  | 'NO_WEBSITE_LISTED'
  | 'FOUND_UNVERIFIED'
  | 'VERIFIED'
  | 'CHECK_FAILED'
  | 'NOT_SUPPORTED';

export type LeadSource =
  | '2GIS'
  | 'OSM'
  | 'FOURSQUARE'
  | 'GOOGLE'
  | 'CSV'
  | 'MANUAL'
  | 'DEMO'
  | 'MULTI';

export type SearchProvider = '2GIS' | 'OSM' | 'FOURSQUARE' | 'GOOGLE';
export type SearchProviderId = '2GIS' | 'OSM' | 'FOURSQUARE' | 'GOOGLE';

export interface LeadSourceMetadata {
  sourceId: LeadSource;
  sourceName: string;
  externalId?: string;
  externalUrl?: string;
  fetchedAt: string;
  originalName?: string;
  originalAddress?: string;
  originalCategory?: string;
  originalPhone?: string;
  originalWebsite?: string;
  confidence?: number;
}

export type ProviderStatusState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'
  | 'not_configured';

export interface ProviderSearchStatus {
  providerId: SearchProviderId;
  providerName: string;
  status: ProviderStatusState;
  totalFound: number;
  error?: string;
  isFromCache?: boolean;
  durationMs?: number;
  requiresKey?: boolean;
  isConfigured?: boolean;
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  type:
    | 'LINK_OPENED'
    | 'MESSAGE_COPIED'
    | 'MARKED_SENT'
    | 'STATUS_CHANGED'
    | 'MESSAGE_EDITED'
    | 'IMPORTED_FROM_2GIS'
    | 'IMPORTED_FROM_OSM'
    | 'IMPORTED_FROM_CSV';
  description: string;
  previousStatus?: LeadStatus;
  newStatus?: LeadStatus;
}

export type LeadGrade = 'A' | 'B' | 'C' | 'D';

export interface LeadScoreFactor {
  factor: string;
  points: number;
  description: string;
}

export interface LeadScoreResult {
  score: number; // 0..100
  grade: LeadGrade;
  reasons: string[];
  factors: LeadScoreFactor[];
}

export interface LeadScoreWeights {
  noWebsiteListed: number;      // default: 40
  validMobilePhone: number;     // default: 25
  validLandlinePhone: number;   // default: 10
  highMarginCategory: number;   // default: 20
  midMarginCategory: number;    // default: 15
  baseCategory: number;         // default: 10
  hasAddress: number;           // default: 6
  hasCoordinates: number;       // default: 4
  verifiedSource2Gis: number;   // default: 5
  verifiedSourceOsm: number;    // default: 3
}

export interface BusinessLead {
  id: string;
  businessName: string;
  category: string;
  phoneRaw: string;
  phoneFormatted: string;
  isValidPhone: boolean;
  phoneError?: string;
  city: string;
  address?: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  websiteStatus: WebsiteStatus;
  websiteUrl?: string;
  externalUrl?: string;
  externalId?: string;
  source?: LeadSource;
  fetchedAt?: string;
  language: Language;
  customMessage?: string;
  status: LeadStatus;
  history: HistoryEvent[];
  notes?: string;
  score?: LeadScoreResult;
  sources?: LeadSourceMetadata[];
  userEditedFields?: string[];
  duplicateFlag?: 'EXACT_PHONE' | 'POSSIBLE_NAME_MATCH' | 'BRANCH' | null;
  possibleDuplicateOf?: string;
  mergedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KazakhstanCity {
  id: string;
  name: string;
  nameKz: string;
  regionId: number;
  bbox: [number, number, number, number]; // [south, west, north, east]
  lat: number;
  lon: number;
}

export interface BusinessCategoryOption {
  id: string;
  name: string;
  query: string; // 2GIS query
  osmFilter?: string; // Overpass QL filter e.g. '["shop"="hairdresser"]'
}

export interface DiscoveredCompany {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  phoneRaw: string;
  phoneFormatted: string;
  isValidPhone: boolean;
  phoneError?: string;
  websiteStatus: WebsiteStatus;
  websiteUrl?: string;
  externalUrl?: string;
  source: LeadSource;
  sources?: LeadSourceMetadata[];
  fetchedAt: string;
  duplicateFlag?: 'EXACT_PHONE' | 'POSSIBLE_NAME_MATCH' | 'BRANCH' | null;
  possibleDuplicateOf?: string;
  mergedCount?: number;
  confidenceScore?: number;
}
