import { describe, it, expect } from 'vitest';
import {
  calculateLeadScore,
  isKazakhstanMobile,
  getGradeLabel,
  DEFAULT_LEAD_SCORE_WEIGHTS,
} from './scoring';
import type { BusinessLead } from '../types';

describe('Lead Scoring Engine (src/utils/scoring.ts)', () => {
  it('correctly identifies Kazakhstan mobile numbers', () => {
    expect(isKazakhstanMobile('77011234567')).toBe(true); // Kcell/Activ
    expect(isKazakhstanMobile('77774568000')).toBe(true); // Beeline
    expect(isKazakhstanMobile('77079876543')).toBe(true); // Tele2/Altel
    expect(isKazakhstanMobile('77471112233')).toBe(true); // Tele2
    expect(isKazakhstanMobile('77271234567')).toBe(false); // Almaty landline
    expect(isKazakhstanMobile('77172123456')).toBe(false); // Astana landline
    expect(isKazakhstanMobile('12025550123')).toBe(false); // US phone
    expect(isKazakhstanMobile('')).toBe(false);
  });

  it('calculates hot Grade A score for high margin business without website and with mobile KZ phone', () => {
    const lead: Partial<BusinessLead> = {
      businessName: 'Стоматологическая клиника Дент',
      category: 'dentistry',
      websiteStatus: 'NO_WEBSITE_LISTED',
      isValidPhone: true,
      phoneFormatted: '77771234567',
      address: 'г. Алматы, пр. Абая 50',
      coordinates: { lat: 43.238, lon: 76.945 },
      source: '2GIS',
    };

    const result = calculateLeadScore(lead);

    // 40 (no website) + 25 (mobile KZ) + 20 (high margin) + 6 (address) + 4 (coords) + 5 (2GIS) = 100
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.reasons.length).toBeGreaterThanOrEqual(6);
    expect(result.reasons).toContain('Сайт не найден в проверенных источниках (+40)');
    expect(result.reasons).toContain('Мобильный номер РК (высокая вероятность WhatsApp) (+25)');
    expect(result.reasons).toContain('Высокочековая сфера бизнеса (+20)');
  });

  it('awards 0 points for website when WEBSITE_LISTED and lowers score accordingly', () => {
    const lead: Partial<BusinessLead> = {
      businessName: 'Барбершоп Борода',
      category: 'barbershop',
      websiteStatus: 'WEBSITE_LISTED',
      websiteUrl: 'https://boroda.kz',
      isValidPhone: true,
      phoneFormatted: '77019876543',
      address: 'г. Астана, ул. Достык 1',
      source: '2GIS',
    };

    const result = calculateLeadScore(lead);

    // 0 (website already exists) + 25 (mobile) + 15 (mid margin) + 6 (address) + 5 (2gis) = 51
    expect(result.score).toBe(51);
    expect(result.grade).toBe('C');
    expect(result.reasons).toContain('Сайт уже указан в справочнике (0)');
    expect(result.factors.some((f) => f.factor === 'no_website')).toBe(false);
  });

  it('never assigns negative scores for missing or unknown fields', () => {
    const minimalLead: Partial<BusinessLead> = {
      businessName: 'Киоск',
    };

    const result = calculateLeadScore(minimalLead);

    expect(result.score).toBe(0);
    expect(result.grade).toBe('D');
    expect(result.factors).toEqual([]);
  });

  it('distinguishes landline vs mobile phone scoring', () => {
    const landlineLead: Partial<BusinessLead> = {
      businessName: 'Нотариальная контора',
      category: 'нотариус',
      websiteStatus: 'NO_WEBSITE_LISTED',
      isValidPhone: true,
      phoneFormatted: '77272500000', // Almaty landline
    };

    const result = calculateLeadScore(landlineLead);

    // 40 (no website) + 10 (landline) + 20 (high margin) = 70
    expect(result.score).toBe(70);
    expect(result.grade).toBe('B');
    expect(result.reasons).toContain('Контактный телефон подтверждён (+10)');
  });

  it('supports custom weights override', () => {
    const lead: Partial<BusinessLead> = {
      websiteStatus: 'NO_WEBSITE_LISTED',
    };

    const customWeights = {
      ...DEFAULT_LEAD_SCORE_WEIGHTS,
      noWebsiteListed: 50,
    };

    const result = calculateLeadScore(lead, customWeights);
    expect(result.score).toBe(50);
    expect(result.reasons).toContain('Сайт не найден в проверенных источниках (+50)');
  });

  it('returns valid grade labels and CSS classes', () => {
    expect(getGradeLabel('A').badgeClass).toBe('grade-a');
    expect(getGradeLabel('B').badgeClass).toBe('grade-b');
    expect(getGradeLabel('C').badgeClass).toBe('grade-c');
    expect(getGradeLabel('D').badgeClass).toBe('grade-d');
  });
});
