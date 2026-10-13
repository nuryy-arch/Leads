import { describe, it, expect } from 'vitest';
import type { BusinessLead } from '../types';
import { leadToDbRow, dbRowToLead, LeadRepository } from './leadRepository';

describe('Lead Repository - Row Transformers', () => {
  const sampleLead: BusinessLead = {
    id: 'lead-test-123',
    businessName: 'Тестовая Компания',
    category: 'Стоматология',
    phoneRaw: '+77011234567',
    phoneFormatted: '+7 701 123 4567',
    isValidPhone: true,
    city: 'Алматы',
    address: 'ул. Абая 50',
    websiteStatus: 'NO_WEBSITE_LISTED',
    websiteUrl: undefined,
    source: '2GIS',
    sources: [
      {
        sourceId: '2GIS',
        sourceName: '2GIS',
        fetchedAt: '2026-10-13T09:00:00Z',
      },
    ],
    duplicateFlag: null,
    mergedCount: 1,
    language: 'ru',
    status: 'DO_NOT_CONTACT',
    history: [
      {
        id: 'hist-1',
        timestamp: '2026-10-13T10:00:00Z',
        type: 'STATUS_CHANGED',
        description: 'Установлен статус DO_NOT_CONTACT',
      },
    ],
    score: {
      score: 85,
      grade: 'A',
      reasons: ['Отсутствует сайт (+40)', 'Валидный мобильный WhatsApp (+25)'],
      factors: [
        { factor: 'noWebsiteListed', points: 40, description: 'Сайт отсутствует' },
        { factor: 'validMobilePhone', points: 25, description: 'Мобильный номер' },
      ],
    },
    userEditedFields: ['businessName'],
    createdAt: '2026-10-13T09:00:00Z',
    updatedAt: '2026-10-13T10:00:00Z',
  };

  it('correctly maps BusinessLead to DbLeadRow preserving critical contracts', () => {
    const userId = 'user-uuid-999';
    const row = leadToDbRow(sampleLead, userId);

    expect(row.user_id).toBe(userId);
    expect(row.client_id).toBe('lead-test-123');
    expect(row.business_name).toBe('Тестовая Компания');
    expect(row.category).toBe('Стоматология');
    expect(row.phone_raw).toBe('+77011234567');
    expect(row.phone_formatted).toBe('+7 701 123 4567');
    expect(row.is_valid_phone).toBe(true);
    expect(row.city).toBe('Алматы');
    expect(row.address).toBe('ул. Абая 50');
    expect(row.website_status).toBe('NO_WEBSITE_LISTED');
    expect(row.website_url).toBeNull();
    expect(row.source).toBe('2GIS');
    expect(row.sources[0].sourceId).toBe('2GIS');
    expect(row.status).toBe('DO_NOT_CONTACT');
    expect(row.history).toHaveLength(1);
    expect(row.history[0].type).toBe('STATUS_CHANGED');
    expect(row.score?.score).toBe(85);
    expect(row.score?.grade).toBe('A');
    expect(row.user_edited_fields).toEqual(['businessName']);
  });

  it('correctly maps DbLeadRow back to BusinessLead with full fidelity', () => {
    const userId = 'user-uuid-999';
    const row = leadToDbRow(sampleLead, userId);
    const restored = dbRowToLead(row);

    expect(restored.id).toBe('lead-test-123');
    expect(restored.businessName).toBe('Тестовая Компания');
    expect(restored.category).toBe('Стоматология');
    expect(restored.phoneRaw).toBe('+77011234567');
    expect(restored.phoneFormatted).toBe('+7 701 123 4567');
    expect(restored.isValidPhone).toBe(true);
    expect(restored.status).toBe('DO_NOT_CONTACT');
    expect(restored.score?.score).toBe(85);
    expect(restored.score?.grade).toBe('A');
    expect(restored.history).toHaveLength(1);
    expect(restored.userEditedFields).toContain('businessName');
  });

  it('provides safe fallbacks for optional or empty DB fields', () => {
    const sparseRow = {
      user_id: 'user-sparse',
      client_id: 'lead-sparse',
      business_name: 'Кофейня',
      category: 'Кафе',
      phone_raw: '',
      phone_formatted: '',
      is_valid_phone: false,
      city: 'Астана',
      website_status: 'HAS_WEBSITE',
      merged_count: 1,
      language: 'kz',
      status: 'NEW',
    };

    const lead = dbRowToLead(sparseRow as any);
    expect(lead.id).toBe('lead-sparse');
    expect(lead.businessName).toBe('Кофейня');
    expect(lead.phoneRaw).toBe('');
    expect(lead.isValidPhone).toBe(false);
    expect(lead.sources).toEqual([]);
    expect(lead.history).toEqual([]);
    expect(lead.userEditedFields).toEqual([]);
    expect(lead.status).toBe('NEW');
  });
});

describe('LeadRepository - CRUD Operations Mock', () => {
  it('handles empty batch insert without calling Supabase', async () => {
    const repo = new LeadRepository();
    const result = await repo.batchInsertLeads([], 'user-1');
    expect(result).toEqual({ inserted: 0, failed: 0 });
  });
});
