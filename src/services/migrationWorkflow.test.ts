import { describe, it, expect } from 'vitest';
import type { BusinessLead } from '../types';
import { leadToDbRow, dbRowToLead } from './leadRepository';

describe('Migration & Storage Safety Audit', () => {
  const localLeads: BusinessLead[] = [
    {
      id: 'lead-local-1',
      businessName: 'Кафе Астана',
      category: 'Кафе',
      phoneRaw: '+77011112233',
      phoneFormatted: '+7 701 111 2233',
      isValidPhone: true,
      city: 'Астана',
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: '2GIS',
      language: 'ru',
      status: 'DO_NOT_CONTACT',
      history: [
        {
          id: 'hist-1',
          timestamp: '2026-10-13T10:00:00Z',
          type: 'STATUS_CHANGED',
          description: 'Клиент отказался от контакта',
        },
      ],
      createdAt: '2026-10-13T10:00:00Z',
      updatedAt: '2026-10-13T10:00:00Z',
    },
    {
      id: 'lead-local-2',
      businessName: 'Салон Красоты',
      category: 'Салон красоты',
      phoneRaw: '+77023334455',
      phoneFormatted: '+7 702 333 4455',
      isValidPhone: true,
      city: 'Алматы',
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: 'OSM',
      language: 'ru',
      status: 'LINK_OPENED',
      history: [
        {
          id: 'hist-2',
          timestamp: '2026-10-13T11:00:00Z',
          type: 'LINK_OPENED',
          description: 'Открыта ссылка в WhatsApp',
        },
      ],
      createdAt: '2026-10-13T11:00:00Z',
      updatedAt: '2026-10-13T11:00:00Z',
    },
  ];

  it('correctly filters out leads that are already synced with the cloud', () => {
    // Simulate cloud having already lead-local-1
    const cloudLeads: BusinessLead[] = [localLeads[0]];
    const cloudClientIds = new Set(cloudLeads.map((l) => l.id));

    const toUpload = localLeads.filter((l) => !cloudClientIds.has(l.id));

    expect(toUpload).toHaveLength(1);
    expect(toUpload[0].id).toBe('lead-local-2');
  });

  it('guarantees LINK_OPENED is not mutated into SENT during DB serialization cycle', () => {
    const lead = localLeads[1];
    expect(lead.status).toBe('LINK_OPENED');

    const dbRow = leadToDbRow(lead, 'user-test-uuid');
    expect(dbRow.status).toBe('LINK_OPENED');

    const restored = dbRowToLead(dbRow);
    expect(restored.status).toBe('LINK_OPENED');
    expect(restored.status).not.toBe('SENT');
  });

  it('guarantees DO_NOT_CONTACT is immutably preserved with complete history', () => {
    const lead = localLeads[0];
    const dbRow = leadToDbRow(lead, 'user-test-uuid');
    const restored = dbRowToLead(dbRow);

    expect(restored.status).toBe('DO_NOT_CONTACT');
    expect(restored.history).toHaveLength(1);
    expect(restored.history[0].description).toBe('Клиент отказался от контакта');
  });
});
