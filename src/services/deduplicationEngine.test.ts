import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  calculateNameSimilarity,
  isDifferentBranch,
  mergeDiscoveredCompanies,
  consolidateDiscoveredBatch,
  correlateWithCrm,
  syncLeadWithIncoming,
} from './deduplicationEngine';
import type { BusinessLead, DiscoveredCompany } from '../types';

describe('Deduplication & Branch Merging Engine', () => {
  it('normalizes company names by removing legal forms, quotes, and punctuation', () => {
    expect(normalizeName('ТОО "Барбершоп Борода"')).toBe('барбершоп борода');
    expect(normalizeName('ИП «Chop-Chop» LLP')).toBe('chop chop');
    expect(normalizeName('Салон Красоты  Аида - 2')).toBe('салон красоты аида 2');
  });

  it('calculates name similarity with token overlap', () => {
    const simExact = calculateNameSimilarity('Barbershop OldBoy', 'Barbershop OldBoy');
    expect(simExact).toBe(1);

    const simLegal = calculateNameSimilarity('ТОО "Barbershop OldBoy"', 'Barbershop OldBoy');
    expect(simLegal).toBe(1);

    const simDiff = calculateNameSimilarity('Стоматология Дент', 'Автомойка Самал');
    expect(simDiff).toBeLessThan(0.2);
  });

  it('identifies different branches of the same chain at distinct addresses', () => {
    const branchA = {
      name: 'Coffee Boom',
      city: 'Астана',
      address: 'пр. Мангилик Ел, 28',
      phoneFormatted: '77011112233',
    };
    const branchB = {
      name: 'Coffee Boom',
      city: 'Астана',
      address: 'ул. Достык, 9',
      phoneFormatted: '77014445566',
    };

    expect(isDifferentBranch(branchA, branchB)).toBe(true);
  });

  it('merges cross-source records with matching valid phone numbers into one consolidated entity', () => {
    const company2Gis: DiscoveredCompany = {
      id: '2gis-123',
      name: 'Chop-Chop',
      category: 'Барбершоп',
      city: 'Алматы',
      address: 'ул. Абая, 50',
      phoneRaw: '+7 777 123 45 67',
      phoneFormatted: '77771234567',
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: '2GIS',
      sources: [
        {
          sourceId: '2GIS',
          sourceName: '2GIS',
          externalId: '123',
          fetchedAt: '2026-10-13T10:00:00Z',
          confidence: 95,
        },
      ],
      fetchedAt: '2026-10-13T10:00:00Z',
    };

    const companyOsm: DiscoveredCompany = {
      id: 'osm-456',
      name: 'Chop Chop Barbershop',
      category: 'barbershop',
      city: 'Алматы',
      address: 'Абая 50',
      coordinates: { lat: 43.238, lon: 76.945 },
      phoneRaw: '77771234567',
      phoneFormatted: '77771234567',
      isValidPhone: true,
      websiteStatus: 'WEBSITE_LISTED',
      websiteUrl: 'https://chopchop.kz',
      source: 'OSM',
      sources: [
        {
          sourceId: 'OSM',
          sourceName: 'OpenStreetMap',
          externalId: '456',
          fetchedAt: '2026-10-13T10:05:00Z',
          confidence: 85,
        },
      ],
      fetchedAt: '2026-10-13T10:05:00Z',
    };

    const merged = mergeDiscoveredCompanies(company2Gis, companyOsm);

    expect(merged.source).toBe('MULTI');
    expect(merged.sources).toHaveLength(2);
    expect(merged.phoneFormatted).toBe('77771234567');
    expect(merged.websiteUrl).toBe('https://chopchop.kz');
    expect(merged.websiteStatus).toBe('WEBSITE_LISTED');
    expect(merged.coordinates).toEqual({ lat: 43.238, lon: 76.945 });
    expect(merged.mergedCount).toBe(2);
  });

  it('consolidates batch and separates chain branches from true duplicates', () => {
    const rawBatch: DiscoveredCompany[] = [
      {
        id: 'c1',
        name: 'Dodo Pizza',
        category: 'Пиццерия',
        city: 'Астана',
        address: 'пр. Туран, 37',
        phoneRaw: '77011111111',
        phoneFormatted: '77011111111',
        isValidPhone: true,
        websiteStatus: 'NO_WEBSITE_LISTED',
        source: '2GIS',
        fetchedAt: '2026-10-13T10:00:00Z',
      },
      {
        id: 'c2',
        name: 'Dodo Pizza',
        category: 'Пиццерия',
        city: 'Астана',
        address: 'ул. Сарайшык, 5',
        phoneRaw: '77012222222',
        phoneFormatted: '77012222222',
        isValidPhone: true,
        websiteStatus: 'NO_WEBSITE_LISTED',
        source: '2GIS',
        fetchedAt: '2026-10-13T10:00:00Z',
      },
      {
        id: 'c3',
        name: 'Dodo Pizza',
        category: 'fast_food',
        city: 'Астана',
        address: 'Туран 37',
        phoneRaw: '77011111111',
        phoneFormatted: '77011111111',
        isValidPhone: true,
        websiteStatus: 'WEBSITE_LISTED',
        websiteUrl: 'https://dodopizza.kz',
        source: 'OSM',
        fetchedAt: '2026-10-13T10:00:00Z',
      },
    ];

    const result = consolidateDiscoveredBatch(rawBatch);

    // c1 and c3 have same phone 77011111111 -> merged into 1
    // c2 is at a different address and phone -> preserved as BRANCH!
    expect(result.companies).toHaveLength(2);
    expect(result.stats.mergedCount).toBe(1);
    expect(result.companies.some((c) => c.duplicateFlag === 'BRANCH')).toBe(true);
  });

  it('protects user-edited CRM fields and DO_NOT_CONTACT status during sync', () => {
    const existingLead: BusinessLead = {
      id: 'lead-1',
      businessName: 'Ручное Название Компании',
      category: 'Барбершоп',
      phoneRaw: '+7 777 999 88 77',
      phoneFormatted: '77779998877',
      isValidPhone: true,
      city: 'Алматы',
      address: 'Специфический Ручной Адрес',
      websiteStatus: 'NO_WEBSITE_LISTED',
      language: 'ru',
      status: 'DO_NOT_CONTACT',
      history: [],
      notes: 'Клиент отказался, не звонить!',
      userEditedFields: ['businessName', 'address', 'status', 'notes'],
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    };

    const incomingData: DiscoveredCompany = {
      id: '2gis-new',
      name: 'Автоматическое Название из 2GIS',
      category: 'Салон',
      city: 'Алматы',
      address: 'Новый адрес из 2GIS',
      phoneRaw: '77779998877',
      phoneFormatted: '77779998877',
      isValidPhone: true,
      websiteStatus: 'WEBSITE_LISTED',
      websiteUrl: 'https://autosalon.kz',
      source: '2GIS',
      fetchedAt: '2026-10-13T10:00:00Z',
    };

    const synced = syncLeadWithIncoming(existingLead, incomingData);

    // User-edited fields MUST NOT be overwritten!
    expect(synced.businessName).toBe('Ручное Название Компании');
    expect(synced.address).toBe('Специфический Ручной Адрес');
    expect(synced.status).toBe('DO_NOT_CONTACT');
    expect(synced.notes).toBe('Клиент отказался, не звонить!');

    // Non-edited empty fields get filled
    expect(synced.websiteUrl).toBe('https://autosalon.kz');
    expect(synced.sources).toBeDefined();
  });

  it('correlates discovered companies with existing CRM leads', () => {
    const existingLeads: BusinessLead[] = [
      {
        id: 'crm-1',
        businessName: 'Barber Club',
        category: 'Барбершоп',
        phoneRaw: '77015555555',
        phoneFormatted: '77015555555',
        isValidPhone: true,
        city: 'Алматы',
        address: 'Абая, 1',
        websiteStatus: 'NO_WEBSITE_LISTED',
        language: 'ru',
        status: 'NEW',
        history: [],
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
    ];

    const discovered: DiscoveredCompany[] = [
      {
        id: 'disc-1',
        name: 'Barber Club',
        category: 'Барбершоп',
        city: 'Алматы',
        address: 'Абая, 1',
        phoneRaw: '77015555555',
        phoneFormatted: '77015555555',
        isValidPhone: true,
        websiteStatus: 'NO_WEBSITE_LISTED',
        source: '2GIS',
        fetchedAt: '2026-10-13T10:00:00Z',
      },
      {
        id: 'disc-2',
        name: 'Новая Студия',
        category: 'Салон',
        city: 'Алматы',
        address: 'Гоголя, 20',
        phoneRaw: '77028888888',
        phoneFormatted: '77028888888',
        isValidPhone: true,
        websiteStatus: 'NO_WEBSITE_LISTED',
        source: 'OSM',
        fetchedAt: '2026-10-13T10:00:00Z',
      },
    ];

    const { annotated, stats } = correlateWithCrm(discovered, existingLeads);

    expect(annotated).toHaveLength(2);
    expect(annotated[0].duplicateFlag).toBe('EXACT_PHONE');
    expect(annotated[0].possibleDuplicateOf).toBe('crm-1');
    expect(annotated[1].duplicateFlag).toBeNull();
    expect(stats.alreadyInCrmCount).toBe(1);
    expect(stats.newUniqueCount).toBe(1);
  });
});
