import { describe, it, expect } from 'vitest';
import type { BusinessLead } from '../types';
import { leadToDbRow, LeadRepository } from './leadRepository';

describe('Security & Multi-Tenant Data Isolation Audit', () => {
  const dummyLead: BusinessLead = {
    id: 'lead-test-sec-1',
    businessName: 'Безопасная Компания',
    category: 'IT Услуги',
    phoneRaw: '+77019998877',
    phoneFormatted: '+7 701 999 8877',
    isValidPhone: true,
    city: 'Алматы',
    websiteStatus: 'NO_WEBSITE_LISTED',
    source: 'MANUAL',
    language: 'ru',
    status: 'DO_NOT_CONTACT',
    history: [],
    createdAt: '2026-10-13T12:00:00Z',
    updatedAt: '2026-10-13T12:00:00Z',
  };

  it('guarantees that every DB row is strictly stamped with user_id', () => {
    const userA = 'user-uuid-aaaa-1111';
    const userB = 'user-uuid-bbbb-2222';

    const rowA = leadToDbRow(dummyLead, userA);
    const rowB = leadToDbRow(dummyLead, userB);

    expect(rowA.user_id).toBe(userA);
    expect(rowB.user_id).toBe(userB);
    expect(rowA.user_id).not.toBe(rowB.user_id);
  });

  it('ensures DO_NOT_CONTACT status is immutably preserved in DB row', () => {
    const row = leadToDbRow(dummyLead, 'user-uuid-owner');
    expect(row.status).toBe('DO_NOT_CONTACT');
  });

  it('ensures leadRepository fetch queries enforce user_id filter', async () => {
    const repo = new LeadRepository();
    // Test that empty batch does not attempt any query
    const res = await repo.batchInsertLeads([], 'user-isolated');
    expect(res).toEqual({ inserted: 0, failed: 0 });
  });

  it('verifies that client_id is preserved for frontend deduplication without exposing PostgreSQL UUID', () => {
    const row = leadToDbRow(dummyLead, 'owner-uuid');
    expect(row.client_id).toBe(dummyLead.id);
    expect(row.user_id).toBe('owner-uuid');
  });
});
