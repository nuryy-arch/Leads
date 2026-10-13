import { describe, it, expect } from 'vitest';
import {
  detectCsvDelimiter,
  parseCsvToMatrix,
  checkDuplicateOrBranch,
  processImportMatrix,
} from './fileImport';
import type { BusinessLead } from '../types';

describe('File Import & Branch Deduplication (src/utils/fileImport.ts)', () => {
  const existingLeads: BusinessLead[] = [
    {
      id: 'lead-1',
      businessName: 'Coffee Boom',
      category: 'Кофейня',
      city: 'Алматы',
      address: 'пр. Достык 42',
      phoneRaw: '+7 777 111-22-33',
      phoneFormatted: '77771112233',
      isValidPhone: true,
      websiteStatus: 'NO_WEBSITE_LISTED',
      language: 'ru',
      status: 'NEW',
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'lead-2',
      businessName: 'Салон Лилия',
      category: 'Салон красоты',
      city: 'Астана',
      address: 'ул. Сыганак 10',
      phoneRaw: '+7 701 444-55-66',
      phoneFormatted: '77014445566',
      isValidPhone: true,
      websiteStatus: 'WEBSITE_LISTED',
      language: 'ru',
      status: 'NEW',
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('detects semicolon and comma delimiters', () => {
    expect(detectCsvDelimiter('Название;Телефон;Город\nA;777;Алматы')).toBe(';');
    expect(detectCsvDelimiter('Название,Телефон,Город\nA,777,Алматы')).toBe(',');
    expect(detectCsvDelimiter('Название\tТелефон\tГород\nA\t777\tАлматы')).toBe('\t');
  });

  it('parses CSV with UTF-8 BOM, quoted strings, and escaped quotes', () => {
    const csvContent =
      '\uFEFF"Название";"Телефон";"Город";"Адрес"\n' +
      '"Студия ""Аура""";"+7 (777) 456-80-00";"Алматы";"ул. Абая, д. 10; офис 5"\n';

    const matrix = parseCsvToMatrix(csvContent);
    expect(matrix.length).toBe(2);
    expect(matrix[0]).toEqual(['Название', 'Телефон', 'Город', 'Адрес']);
    expect(matrix[1][0]).toBe('Студия "Аура"');
    expect(matrix[1][1]).toBe('+7 (777) 456-80-00');
    expect(matrix[1][2]).toBe('Алматы');
    expect(matrix[1][3]).toBe('ул. Абая, д. 10; офис 5');
  });

  it('identifies phone duplicate regardless of business name', () => {
    const candidate = {
      businessName: 'Coffee Boom New Branch',
      city: 'Алматы',
      address: 'ул. Жандосова 15',
      phoneFormatted: '77771112233', // matches lead-1
      isValidPhone: true,
    };

    const res = checkDuplicateOrBranch(candidate, existingLeads);
    expect(res.status).toBe('DUPLICATE');
    expect(res.message).toContain('Дубликат по номеру телефона');
  });

  it('does NOT collapse different branches of same chain in same city when addresses differ', () => {
    const branchCandidate = {
      businessName: 'Coffee Boom',
      city: 'Алматы',
      address: 'ТРЦ Mega Center, ул. Розыбакиева 247', // different address than пр. Достык 42
      phoneFormatted: '77779998877', // different phone
      isValidPhone: true,
    };

    const res = checkDuplicateOrBranch(branchCandidate, existingLeads);
    expect(res.status).toBe('BRANCH');
    expect(res.message).toContain('Филиал сети');
    expect(res.message).toContain('другой адрес');
  });

  it('marks exact match as duplicate if addresses are missing or identical', () => {
    const duplicateCandidate = {
      businessName: 'Coffee Boom',
      city: 'Алматы',
      address: 'пр. Достык 42',
      phoneFormatted: '',
      isValidPhone: false,
    };

    const res = checkDuplicateOrBranch(duplicateCandidate, existingLeads);
    expect(res.status).toBe('DUPLICATE');
  });

  it('correctly processes whole matrix into summary with scores and validation', () => {
    const matrix = [
      ['Компания', 'Телефон', 'Сфера', 'Город', 'Адрес', 'Сайт'],
      ['Стоматология Дент', '+7 777 999 11 22', 'dentistry', 'Алматы', 'ул. Гоголя 15', ''],
      ['Coffee Boom', '+7 777 111-22-33', 'Кофейня', 'Алматы', 'пр. Достык 42', ''], // duplicate
      ['Coffee Boom', '+7 705 333 44 55', 'Кофейня', 'Алматы', 'ул. Сатпаева 90', ''], // branch
      ['', '+7 777 000 00 00', 'Сфера', 'Астана', '', ''], // error: no name
    ];

    const summary = processImportMatrix(matrix, existingLeads, 'test.csv');

    expect(summary.totalRows).toBe(4);
    expect(summary.validCount).toBe(1);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.branchCount).toBe(1);
    expect(summary.errorCount).toBe(1);

    // Row 1: Valid Dent
    expect(summary.rows[0].status).toBe('VALID');
    expect(summary.rows[0].included).toBe(true);
    expect(summary.rows[0].score).toBeGreaterThanOrEqual(85); // High margin + no website + mobile KZ = hot

    // Row 2: Duplicate Coffee Boom by phone
    expect(summary.rows[1].status).toBe('DUPLICATE');
    expect(summary.rows[1].included).toBe(false);

    // Row 3: Branch Coffee Boom
    expect(summary.rows[2].status).toBe('BRANCH');
    expect(summary.rows[2].included).toBe(true);

    // Row 4: Error
    expect(summary.rows[3].status).toBe('ERROR');
    expect(summary.rows[3].included).toBe(false);
  });
});
