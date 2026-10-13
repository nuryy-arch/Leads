import type { DiscoveredCompany, WebsiteStatus } from '../types';
import { normalizePhoneNumber } from '../utils/whatsapp';

export const TWO_GIS_STORAGE_KEY = 'twogis_api_key_v1';

export interface TwoGisSearchOptions {
  apiKey: string;
  query: string;
  cityName: string;
  regionId?: number;
  page?: number;
  pageSize?: number;
}

export interface TwoGisSearchResult {
  total: number;
  companies: DiscoveredCompany[];
  page: number;
  pageSize: number;
  error?: string;
}

export interface ApiKeyVerificationResult {
  isValid: boolean;
  message: string;
  code?: number;
}

/**
 * Retrieves the stored 2GIS API key from localStorage or Vite environment variable
 */
export function getStoredTwoGisApiKey(): string {
  try {
    const saved = localStorage.getItem(TWO_GIS_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}

  const envKey = (import.meta as any).env?.VITE_2GIS_API_KEY;
  if (typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }

  return '';
}

/**
 * Saves the 2GIS API key to localStorage
 */
export function saveTwoGisApiKey(apiKey: string): void {
  try {
    if (apiKey.trim()) {
      localStorage.setItem(TWO_GIS_STORAGE_KEY, apiKey.trim());
    } else {
      localStorage.removeItem(TWO_GIS_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to save 2GIS API key to localStorage', e);
  }
}

/**
 * Removes the stored 2GIS API key from localStorage
 */
export function removeTwoGisApiKey(): void {
  try {
    localStorage.removeItem(TWO_GIS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to remove 2GIS API key from localStorage', e);
  }
}

function getApiBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.vercel.app') ||
      window.location.hostname.includes('cloudflare') ||
      window.location.port === '5173')
  ) {
    return '/api/2gis/3.0/items';
  }
  return typeof window !== 'undefined' ? '/api/2gis/3.0/items' : 'https://catalog.api.2gis.com/3.0/items';
}

/**
 * Verifies a 2GIS API key by performing a live test query
 */
export async function verifyTwoGisApiKey(apiKey: string): Promise<ApiKeyVerificationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      isValid: false,
      message: 'API-ключ не указан. Введите ключ для проверки.',
    };
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}?q=test&key=${encodeURIComponent(trimmed)}&page_size=1`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data?.meta?.code === 200) {
      return {
        isValid: true,
        message: 'Ключ 2GIS API успешно проверен и активен!',
        code: 200,
      };
    }

    const errorMsg =
      data?.meta?.error?.message ||
      `Ошибка авторизации 2GIS API (HTTP ${response.status}: ${response.statusText})`;

    return {
      isValid: false,
      message: errorMsg,
      code: data?.meta?.code || response.status,
    };
  } catch (err: any) {
    return {
      isValid: false,
      message: `Ошибка сетевого запроса к 2GIS: ${err.message || 'Не удалось связаться с сервером'}`,
    };
  }
}

/**
 * Searches real companies via official 2GIS Catalog API
 */
export async function searchTwoGisCompanies(
  options: TwoGisSearchOptions
): Promise<TwoGisSearchResult> {
  const { apiKey, query, cityName, regionId, page = 1, pageSize = 20 } = options;

  if (!apiKey || !apiKey.trim()) {
    return {
      total: 0,
      companies: [],
      page,
      pageSize,
      error: 'Отсутствует API-ключ 2GIS. Укажите ключ в настройках поиска.',
    };
  }

  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('key', apiKey.trim());
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  params.set(
    'fields',
    'items.contact_groups,items.address_name,items.rubrics,items.links,items.adm_div'
  );

  if (regionId) {
    params.set('region_id', String(regionId));
  }

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || data?.meta?.code !== 200) {
      const errorMsg =
        data?.meta?.error?.message ||
        `2GIS API вернул ошибку (HTTP ${response.status}: ${response.statusText})`;
      return {
        total: 0,
        companies: [],
        page,
        pageSize,
        error: errorMsg,
      };
    }

    const items = data?.result?.items || [];
    const total = data?.result?.total || items.length;

    const companies: DiscoveredCompany[] = items.map((item: any) => {
      // Extract phones and websites from contact_groups
      let rawPhone = '';
      let websiteUrl = '';

      if (Array.isArray(item.contact_groups)) {
        for (const group of item.contact_groups) {
          if (Array.isArray(group.contacts)) {
            for (const contact of group.contacts) {
              if (contact.type === 'phone' && !rawPhone) {
                rawPhone = contact.value || contact.text || '';
              }
              if (
                (contact.type === 'website' || contact.type === 'url') &&
                !websiteUrl
              ) {
                websiteUrl = contact.value || contact.text || '';
              }
            }
          }
        }
      }

      // Check website status according to requirement 4:
      // "Если сайт не найден, используй статус NO_WEBSITE_LISTED, а не утверждение, что сайта точно не существует."
      const websiteStatus: WebsiteStatus =
        websiteUrl && websiteUrl.trim().length > 0
          ? 'WEBSITE_LISTED'
          : 'NO_WEBSITE_LISTED';

      // Normalize phone
      const phoneCheck = rawPhone
        ? normalizePhoneNumber(rawPhone)
        : { isValid: false, normalized: '', error: 'Номер телефона не указан' };

      // Category
      const primaryRubric = item.rubrics?.[0]?.name || query;

      // Address
      const address =
        item.address_name ||
        item.full_address_name ||
        item.adm_div?.city?.name ||
        cityName;

      // External 2GIS link
      const citySlug = getCitySlug(cityName);
      const externalUrl =
        item.links?.catalog ||
        (item.id
          ? `https://2gis.kz/${citySlug}/firm/${item.id}`
          : `https://2gis.kz/${citySlug}/search/${encodeURIComponent(item.name || query)}`);

      return {
        id: `2gis-${item.id || Math.random().toString(36).substring(2, 9)}`,
        name: item.name || 'Организация',
        category: primaryRubric,
        city: cityName,
        address,
        phoneRaw: rawPhone,
        phoneFormatted: phoneCheck.normalized,
        isValidPhone: phoneCheck.isValid,
        phoneError: phoneCheck.error,
        websiteStatus,
        websiteUrl: websiteUrl ? normalizeWebsiteUrl(websiteUrl) : undefined,
        externalUrl,
        source: '2GIS' as const,
        fetchedAt: new Date().toISOString(),
      };
    });

    return {
      total,
      companies,
      page,
      pageSize,
    };
  } catch (err: any) {
    return {
      total: 0,
      companies: [],
      page,
      pageSize,
      error: `Сетевая ошибка при обращении к 2GIS API: ${err.message || 'Проверьте подключение к интернету'}`,
    };
  }
}

/**
 * Normalizes website URLs (ensures https:// prefix)
 */
function normalizeWebsiteUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Helper to determine 2GIS city subdomain/slug
 */
function getCitySlug(cityName: string): string {
  const map: Record<string, string> = {
    Алматы: 'almaty',
    Астана: 'astana',
    Шымкент: 'shymkent',
    Караганда: 'karaganda',
    Актобе: 'aktobe',
    Павлодар: 'pavlodar',
    'Усть-Каменогорск': 'oskemen',
    Семей: 'semey',
    Атырау: 'atyrau',
    Костанай: 'kostanay',
    Тараз: 'taraz',
    Уральск: 'oral',
    Актау: 'aktau',
    Петропавловск: 'petropavlovsk',
    Туркестан: 'turkestan',
    Кызылорда: 'kyzylorda',
    Кокшетау: 'kokshetau',
    Темиртау: 'temirtau',
  };
  return map[cityName] || 'almaty';
}
