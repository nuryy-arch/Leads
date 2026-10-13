export type LeadStatus =
  | 'NEW'
  | 'LINK_OPENED'
  | 'SENT'
  | 'INTERESTED'
  | 'REJECTED'
  | 'DO_NOT_CONTACT';

export type Language = 'ru' | 'kz';

export type WebsiteStatus = 'WEBSITE_LISTED' | 'NO_WEBSITE_LISTED';

export type LeadSource = '2GIS' | 'OSM' | 'MANUAL' | 'DEMO';

export type SearchProvider = '2GIS' | 'OSM';

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
    | 'IMPORTED_FROM_OSM';
  description: string;
  previousStatus?: LeadStatus;
  newStatus?: LeadStatus;
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
  source: '2GIS' | 'OSM';
  fetchedAt: string;
}
