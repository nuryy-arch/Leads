import type { BusinessLead } from '../types';
import { getSupabase } from './supabaseClient';

export interface DbLeadRow {
  id?: string;
  user_id: string;
  client_id: string;
  business_name: string;
  category: string;
  phone_raw: string;
  phone_formatted: string;
  is_valid_phone: boolean;
  phone_error?: string | null;
  city: string;
  address?: string | null;
  coordinates?: any;
  website_status: string;
  website_url?: string | null;
  external_url?: string | null;
  external_id?: string | null;
  source: string;
  sources?: any;
  duplicate_flag?: string | null;
  possible_duplicate_of?: string | null;
  merged_count: number;
  language: string;
  custom_message?: string | null;
  status: string;
  history?: any;
  notes?: string | null;
  score?: any;
  user_edited_fields?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Transforms a client-side BusinessLead into a database row
 */
export function leadToDbRow(lead: BusinessLead, userId: string): DbLeadRow {
  return {
    user_id: userId,
    client_id: lead.id,
    business_name: lead.businessName,
    category: lead.category,
    phone_raw: lead.phoneRaw || '',
    phone_formatted: lead.phoneFormatted || '',
    is_valid_phone: lead.isValidPhone,
    phone_error: lead.phoneError || null,
    city: lead.city,
    address: lead.address || null,
    coordinates: lead.coordinates || null,
    website_status: lead.websiteStatus,
    website_url: lead.websiteUrl || null,
    external_url: lead.externalUrl || null,
    external_id: lead.externalId || null,
    source: lead.source || 'MANUAL',
    sources: lead.sources || [],
    duplicate_flag: lead.duplicateFlag || null,
    possible_duplicate_of: lead.possibleDuplicateOf || null,
    merged_count: lead.mergedCount || 1,
    language: lead.language || 'ru',
    custom_message: lead.customMessage || null,
    status: lead.status || 'NEW',
    history: lead.history || [],
    notes: lead.notes || null,
    score: lead.score || null,
    user_edited_fields: lead.userEditedFields || [],
    created_at: lead.createdAt || new Date().toISOString(),
    updated_at: lead.updatedAt || new Date().toISOString(),
  };
}

/**
 * Transforms a PostgreSQL row back into a frontend BusinessLead
 */
export function dbRowToLead(row: DbLeadRow): BusinessLead {
  return {
    id: row.client_id || row.id || `lead-${Date.now()}`,
    businessName: row.business_name,
    category: row.category,
    phoneRaw: row.phone_raw || '',
    phoneFormatted: row.phone_formatted || '',
    isValidPhone: Boolean(row.is_valid_phone),
    phoneError: row.phone_error || undefined,
    city: row.city,
    address: row.address || undefined,
    coordinates: row.coordinates || undefined,
    websiteStatus: (row.website_status as any) || 'NO_WEBSITE_LISTED',
    websiteUrl: row.website_url || undefined,
    externalUrl: row.external_url || undefined,
    externalId: row.external_id || undefined,
    source: (row.source as any) || 'MANUAL',
    sources: Array.isArray(row.sources) ? row.sources : [],
    duplicateFlag: (row.duplicate_flag as any) || null,
    possibleDuplicateOf: row.possible_duplicate_of || undefined,
    mergedCount: row.merged_count || 1,
    language: (row.language as any) || 'ru',
    customMessage: row.custom_message || undefined,
    status: (row.status as any) || 'NEW',
    history: Array.isArray(row.history) ? row.history : [],
    notes: row.notes || undefined,
    score: row.score || undefined,
    userEditedFields: Array.isArray(row.user_edited_fields) ? row.user_edited_fields : [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Cloud Lead Repository providing isolated CRUD operations on Supabase PostgreSQL
 */
export class LeadRepository {
  /**
   * Fetches all leads belonging to the authorized user
   */
  async fetchUserLeads(userId: string): Promise<BusinessLead[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Ошибка загрузки лидов из Supabase: ${error.message}`);
    }

    return (data || []).map(dbRowToLead);
  }

  /**
   * Creates a single lead in Supabase
   */
  async createLead(lead: BusinessLead, userId: string): Promise<BusinessLead> {
    const supabase = getSupabase();
    const row = leadToDbRow(lead, userId);

    const { data, error } = await supabase
      .from('leads')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Ошибка создания лида в Supabase: ${error.message}`);
    }

    return dbRowToLead(data);
  }

  /**
   * Updates an existing lead in Supabase
   */
  async updateLead(lead: BusinessLead, userId: string): Promise<BusinessLead> {
    const supabase = getSupabase();
    const row = leadToDbRow(lead, userId);

    const { data, error } = await supabase
      .from('leads')
      .update(row)
      .eq('client_id', lead.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Ошибка обновления лида в Supabase: ${error.message}`);
    }

    return dbRowToLead(data);
  }

  /**
   * Deletes a lead by client_id in Supabase
   */
  async deleteLead(leadId: string, userId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('client_id', leadId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Ошибка удаления лида в Supabase: ${error.message}`);
    }
  }

  /**
   * Batch inserts leads into Supabase with chunking for large datasets
   */
  async batchInsertLeads(
    leads: BusinessLead[],
    userId: string,
    chunkSize = 50
  ): Promise<{ inserted: number; failed: number }> {
    if (leads.length === 0) return { inserted: 0, failed: 0 };

    const supabase = getSupabase();
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < leads.length; i += chunkSize) {
      const chunk = leads.slice(i, i + chunkSize);
      const rows = chunk.map((lead) => leadToDbRow(lead, userId));

      const { data, error } = await supabase
        .from('leads')
        .insert(rows)
        .select('id');

      if (error) {
        console.error('Batch insert chunk error:', error.message);
        failed += chunk.length;
      } else {
        inserted += (data?.length || chunk.length);
      }
    }

    return { inserted, failed };
  }
}

export const leadRepository = new LeadRepository();
