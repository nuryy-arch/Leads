import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isDuplicateLead,
  convertDiscoveredToLead,
} from '../utils/leadManagement';
import {
  searchTwoGisCompanies,
  verifyTwoGisApiKey,
} from './twoGisService';
import type { BusinessLead, DiscoveredCompany } from '../types';

describe('Lead Management & Deduplication', () => {
  const existingLeads: BusinessLead[] = [
    {
      id: 'lead-1',
      businessName: 'Chop-Chop Barbershop',
      category: 'Барбершоп',
      phoneRaw: '+7 (777) 123-45-67',
      phoneFormatted: '77771234567',
      isValidPhone: true,
      city: 'Алматы',
      websiteStatus: 'WEBSITE_LISTED',
      websiteUrl: 'https://chopchop.kz',
      language: 'ru',
      status: 'NEW',
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'lead-2',
      businessName: 'Aura Studio',
      category: 'Салон красоты',
      phoneRaw: '',
      phoneFormatted: '',
      isValidPhone: false,
      city: 'Астана',
      websiteStatus: 'NO_WEBSITE_LISTED',
      language: 'ru',
      status: 'NEW',
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('detects duplicate lead by formatted phone number even if raw phone format differs', () => {
    const candidate: DiscoveredCompany = {
      id: '2gis-new',
      name: 'Другое название Chop-Chop',
      category: 'Барбершоп',
      city: 'Алматы',
      address: 'ул. Достык 10',
      phoneRaw: '8 (777) 123-45-67',
      phoneFormatted: '77771234567', // same phone
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: '2GIS',
    };

    expect(isDuplicateLead(candidate, existingLeads)).toBe(true);
  });

  it('detects duplicate lead by exact name and city if phone is not matched', () => {
    const candidate: DiscoveredCompany = {
      id: '2gis-new-2',
      name: 'Aura Studio',
      category: 'Салон красоты',
      city: 'Астана',
      address: 'ул. Туран 20',
      phoneRaw: '+7 705 999 88 77',
      phoneFormatted: '77059998877',
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: '2GIS',
    };

    expect(isDuplicateLead(candidate, existingLeads)).toBe(true);
  });

  it('allows non-duplicate lead with different name and different phone', () => {
    const candidate: DiscoveredCompany = {
      id: '2gis-new-3',
      name: 'Новый Салон Алматы',
      category: 'Салон красоты',
      city: 'Алматы',
      address: 'пр. Абая 50',
      phoneRaw: '+7 701 555 44 33',
      phoneFormatted: '77015554433',
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: '2GIS',
    };

    expect(isDuplicateLead(candidate, existingLeads)).toBe(false);
  });

  it('converts DiscoveredCompany into BusinessLead with NO_WEBSITE_LISTED status', () => {
    const candidate: DiscoveredCompany = {
      id: '2gis-333',
      name: 'Барбершоп Nomad',
      category: 'Барбершоп',
      city: 'Шымкент',
      address: 'ул. Рыскулова 12',
      phoneRaw: '+7 702 111-22-33',
      phoneFormatted: '77021112233',
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      externalUrl: 'https://2gis.kz/shymkent/firm/12345',
      source: '2GIS',
    };

    const lead = convertDiscoveredToLead(candidate, 'kz');
    expect(lead.businessName).toBe('Барбершоп Nomad');
    expect(lead.city).toBe('Шымкент');
    expect(lead.websiteStatus).toBe('NO_WEBSITE_LISTED');
    expect(lead.websiteUrl).toBeUndefined();
    expect(lead.language).toBe('kz');
    expect(lead.status).toBe('NEW');
    expect(lead.history.length).toBe(1);
    expect(lead.history[0].type).toBe('IMPORTED_FROM_2GIS');
  });
});

describe('2GIS API Service Logic & Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects empty API key during verification', async () => {
    const result = await verifyTwoGisApiKey('   ');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('API-ключ не указан');
  });

  it('reports missing API key error during search', async () => {
    const result = await searchTwoGisCompanies({
      apiKey: '',
      query: 'барбершоп',
      cityName: 'Алматы',
    });

    expect(result.total).toBe(0);
    expect(result.companies).toHaveLength(0);
    expect(result.error).toContain('Отсутствует API-ключ 2GIS');
  });

  it('handles 2GIS API 403 Forbidden response accurately', async () => {
    // Mock fetch returning 2GIS 403 response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        meta: {
          code: 403,
          error: {
            message: 'Authorization error, incorrect key.',
            type: 'forbidden',
          },
        },
      }),
    } as any);

    const result = await verifyTwoGisApiKey('invalid-test-key');
    expect(result.isValid).toBe(false);
    expect(result.message).toBe('Authorization error, incorrect key.');
  });

  it('successfully parses 2GIS items, contacts, and assigns NO_WEBSITE_LISTED when no website exists', async () => {
    // Mock fetch returning realistic 2GIS catalog items
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        meta: { code: 200 },
        result: {
          total: 1,
          items: [
            {
              id: '70000001001',
              name: 'Студия Маникюра «Nail Bar»',
              address_name: 'ул. Сатпаева, 22',
              rubrics: [{ name: 'Ногтевые студии' }],
              contact_groups: [
                {
                  contacts: [
                    { type: 'phone', value: '+7 777 987-65-43' },
                    // Notice: no website contact
                  ],
                },
              ],
            },
          ],
        },
      }),
    } as any);

    const result = await searchTwoGisCompanies({
      apiKey: 'valid-test-key',
      query: 'ногтевая студия',
      cityName: 'Алматы',
      regionId: 68,
    });

    expect(result.total).toBe(1);
    expect(result.companies).toHaveLength(1);

    const company = result.companies[0];
    expect(company.name).toBe('Студия Маникюра «Nail Bar»');
    expect(company.category).toBe('Ногтевые студии');
    expect(company.phoneFormatted).toBe('77779876543');
    expect(company.isValidPhone).toBe(true);
    // Verified requirement 4: status is strictly NO_WEBSITE_LISTED!
    expect(company.websiteStatus).toBe('NO_WEBSITE_LISTED');
    expect(company.websiteUrl).toBeUndefined();
  });
});
