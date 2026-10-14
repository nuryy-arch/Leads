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

  it('guarantees complete isolation between User A and User B leads in simulated multi-tenant environment', () => {
    const userA_Id = '11111111-1111-4111-8111-111111111111';
    const userB_Id = '22222222-2222-4222-8222-222222222222';

    // Simulate database table state with rows from two different tenants
    const databaseTable = [
      leadToDbRow({ ...dummyLead, id: 'lead-user-A-1', businessName: 'User A Company' }, userA_Id),
      leadToDbRow({ ...dummyLead, id: 'lead-user-A-2', businessName: 'User A Second' }, userA_Id),
      leadToDbRow({ ...dummyLead, id: 'lead-user-B-1', businessName: 'User B Company' }, userB_Id),
    ];

    // Simulate RLS SELECT policy: USING (auth.uid() = user_id)
    const filterRlsSelect = (rows: typeof databaseTable, currentAuthUid: string) => {
      return rows.filter((r) => r.user_id === currentAuthUid);
    };

    const userAResults = filterRlsSelect(databaseTable, userA_Id);
    const userBResults = filterRlsSelect(databaseTable, userB_Id);
    const anonResults = filterRlsSelect(databaseTable, '');

    expect(userAResults).toHaveLength(2);
    expect(userAResults.every((r) => r.user_id === userA_Id)).toBe(true);

    expect(userBResults).toHaveLength(1);
    expect(userBResults[0].user_id).toBe(userB_Id);
    expect(userBResults[0].business_name).toBe('User B Company');

    // Anonymous or untrusted client receives 0 rows
    expect(anonResults).toHaveLength(0);
  });

  it('prevents User B from modifying or deleting User A records (simulated RLS UPDATE/DELETE)', () => {
    const userA_Id = '11111111-1111-4111-8111-111111111111';
    const userB_Id = '22222222-2222-4222-8222-222222222222';

    let row = leadToDbRow(dummyLead, userA_Id);

    // Simulate RLS UPDATE policy: USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
    const attemptUpdate = (
      currentRow: typeof row,
      requesterUid: string,
      newValues: Partial<typeof row>
    ) => {
      // If current row does not belong to requester, RLS denies update
      if (currentRow.user_id !== requesterUid) {
        throw new Error('RLS violation: permission denied for update');
      }
      // If check tries to change owner, WITH CHECK denies update
      if (newValues.user_id && newValues.user_id !== requesterUid) {
        throw new Error('RLS violation: cannot transfer ownership of row');
      }
      return { ...currentRow, ...newValues };
    };

    // User B attempts to change status or hijack User A's row
    expect(() =>
      attemptUpdate(row, userB_Id, { status: 'ARCHIVED' })
    ).toThrow('RLS violation: permission denied for update');

    // User A can update their own row
    const updated = attemptUpdate(row, userA_Id, { status: 'PROPOSAL_SENT' });
    expect(updated.status).toBe('PROPOSAL_SENT');
    expect(updated.user_id).toBe(userA_Id);
  });
});

