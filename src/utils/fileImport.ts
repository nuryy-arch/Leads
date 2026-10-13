import { readSheet } from 'read-excel-file/browser';
import type { BusinessLead, WebsiteStatus } from '../types';
import { normalizePhoneNumber } from './whatsapp';
import { calculateLeadScore } from './scoring';

export type ImportRowStatus = 'VALID' | 'DUPLICATE' | 'BRANCH' | 'ERROR';

export interface ParsedImportRow {
  rowNumber: number;
  businessName: string;
  category: string;
  city: string;
  address?: string;
  phoneRaw: string;
  phoneFormatted: string;
  isValidPhone: boolean;
  phoneError?: string;
  websiteStatus: WebsiteStatus;
  websiteUrl?: string;
  notes?: string;
  status: ImportRowStatus;
  statusMessage: string;
  matchedLeadId?: string;
  included: boolean;
  score?: number;
}

export interface FileImportSummary {
  fileName: string;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  branchCount: number;
  errorCount: number;
  rows: ParsedImportRow[];
}

/**
 * Автоматически определяет разделитель для CSV (;, ,, или табуляция)
 */
export function detectCsvDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const countSemicolons = (firstLines.match(/;/g) || []).length;
  const countCommas = (firstLines.match(/,/g) || []).length;
  const countTabs = (firstLines.match(/\t/g) || []).length;

  if (countSemicolons >= countCommas && countSemicolons >= countTabs) return ';';
  if (countTabs > countCommas) return '\t';
  return ',';
}

/**
 * Надежный парсер CSV с поддержкой кавычек, экранирования "" и переносов строк внутри ячеек
 */
export function parseCsvToMatrix(text: string, delimiter?: string): string[][] {
  const delim = delimiter || detectCsvDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Очистка UTF-8 BOM
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // пропуск парной кавычки
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delim && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // пропуск \r\n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Нормализатор заголовков столбцов
function normalizeHeaderName(header: string): string {
  return header.toLowerCase().replace(/[\s_\-.]/g, '');
}

interface ColumnMapping {
  nameIndex: number;
  phoneIndex: number;
  categoryIndex: number;
  cityIndex: number;
  addressIndex: number;
  websiteIndex: number;
  notesIndex: number;
}

function resolveColumnMapping(headers: string[]): ColumnMapping {
  const norm = headers.map(normalizeHeaderName);

  const findIdx = (keywords: string[]) => {
    return norm.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  return {
    nameIndex: findIdx(['название', 'наименование', 'компания', 'бизнес', 'организация', 'name', 'title', 'company']),
    phoneIndex: findIdx(['телефон', 'номер', 'контакт', 'моб', 'phone', 'tel', 'mobile']),
    categoryIndex: findIdx(['категория', 'сфера', 'деятельность', 'рубрика', 'вид', 'category', 'type', 'industry']),
    cityIndex: findIdx(['город', 'населенныйпункт', 'регион', 'city', 'town', 'location']),
    addressIndex: findIdx(['адрес', 'улица', 'дом', 'address', 'street']),
    websiteIndex: findIdx(['сайт', 'веб', 'url', 'ссылка', 'web', 'site', 'website', 'link']),
    notesIndex: findIdx(['заметк', 'примечани', 'комментар', 'описани', 'note', 'desc', 'comment']),
  };
}

/**
 * Проверяет запись на дубликаты и филиалы относительно существующей базы CRM.
 * Не объединяет разные филиалы одной сети при одинаковом названии, если адреса различаются.
 */
export function checkDuplicateOrBranch(
  candidate: {
    businessName: string;
    city: string;
    address?: string;
    phoneFormatted?: string;
    isValidPhone: boolean;
  },
  existingLeads: BusinessLead[]
): {
  status: 'VALID' | 'DUPLICATE' | 'BRANCH';
  message: string;
  matchedLead?: BusinessLead;
} {
  for (const lead of existingLeads) {
    // 1. Точное совпадение по валидному телефону — это 100% дубликат
    if (
      candidate.isValidPhone &&
      lead.isValidPhone &&
      candidate.phoneFormatted &&
      lead.phoneFormatted &&
      candidate.phoneFormatted === lead.phoneFormatted
    ) {
      return {
        status: 'DUPLICATE',
        message: `Дубликат по номеру телефона (+${lead.phoneFormatted}) — организация «${lead.businessName}»`,
        matchedLead: lead,
      };
    }

    // 2. Проверка по связке «Название + Город»
    const nameA = candidate.businessName.trim().toLowerCase();
    const nameB = lead.businessName.trim().toLowerCase();
    const cityA = candidate.city.trim().toLowerCase();
    const cityB = lead.city.trim().toLowerCase();

    if (nameA === nameB && cityA === cityB && nameA.length > 0) {
      const addrA = (candidate.address || '').trim().toLowerCase();
      const addrB = (lead.address || '').trim().toLowerCase();

      // Если у обоих указаны разные фактические адреса — это филиал сети!
      if (addrA.length > 3 && addrB.length > 3 && addrA !== addrB) {
        return {
          status: 'BRANCH',
          message: `Филиал сети «${lead.businessName}» в г. ${lead.city} (другой адрес: «${lead.address}»)`,
          matchedLead: lead,
        };
      }

      // Если адреса совпадают или не указаны — считаем дубликатом
      return {
        status: 'DUPLICATE',
        message: `Совпадение по названию и городу с «${lead.businessName}» (${lead.city})`,
        matchedLead: lead,
      };
    }
  }

  return {
    status: 'VALID',
    message: 'Новый контакт',
  };
}

/**
 * Парсит матрицу строк (из CSV или XLSX) в структурированный предпросмотр
 */
export function processImportMatrix(
  matrix: string[][],
  existingLeads: BusinessLead[],
  fileName: string = 'import.csv'
): FileImportSummary {
  if (matrix.length === 0) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      branchCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  const headerRow = matrix[0];
  const mapping = resolveColumnMapping(headerRow);
  const dataRows = matrix.slice(1);

  const parsedRows: ParsedImportRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let branchCount = 0;
  let errorCount = 0;

  dataRows.forEach((row, idx) => {
    // Пропуск полностью пустых строк
    if (row.every((cell) => !cell || cell.trim().length === 0)) {
      return;
    }

    const rowNumber = idx + 2; // с учетом заголовка (1-indexed)
    const businessName = mapping.nameIndex >= 0 ? row[mapping.nameIndex] || '' : row[0] || '';
    const phoneRaw = mapping.phoneIndex >= 0 ? row[mapping.phoneIndex] || '' : (row[1] || '');
    const category = mapping.categoryIndex >= 0 ? row[mapping.categoryIndex] || 'Общая' : 'Общая';
    const city = mapping.cityIndex >= 0 ? row[mapping.cityIndex] || 'Казахстан' : 'Казахстан';
    const address = mapping.addressIndex >= 0 ? row[mapping.addressIndex] || undefined : undefined;
    const websiteRaw = mapping.websiteIndex >= 0 ? row[mapping.websiteIndex] || '' : '';
    const notes = mapping.notesIndex >= 0 ? row[mapping.notesIndex] || undefined : undefined;

    // Валидация обязательного поля (название бизнеса)
    if (!businessName.trim()) {
      errorCount++;
      parsedRows.push({
        rowNumber,
        businessName: '(Не указано)',
        category,
        city,
        address,
        phoneRaw,
        phoneFormatted: '',
        isValidPhone: false,
        phoneError: 'Отсутствует название организации',
        websiteStatus: 'NO_WEBSITE_LISTED',
        notes,
        status: 'ERROR',
        statusMessage: 'Строка пропущена: не указано название бизнеса',
        included: false,
      });
      return;
    }

    // Нормализация телефона
    const phoneVal = normalizePhoneNumber(phoneRaw);

    // Статус веб-сайта: если сайт не указан, NO_WEBSITE_LISTED
    const hasWebsite = websiteRaw.trim().length > 3 && (websiteRaw.includes('.') || websiteRaw.startsWith('http'));
    const websiteStatus: WebsiteStatus = hasWebsite ? 'WEBSITE_LISTED' : 'NO_WEBSITE_LISTED';
    const websiteUrl = hasWebsite ? websiteRaw.trim() : undefined;

    // Проверка на дубликат или филиал
    const dupCheck = checkDuplicateOrBranch(
      {
        businessName,
        city,
        address,
        phoneFormatted: phoneVal.normalized,
        isValidPhone: phoneVal.isValid,
      },
      existingLeads
    );

    // Расчет предварительного скоринга
    const scoreResult = calculateLeadScore({
      businessName,
      category,
      city,
      address,
      phoneFormatted: phoneVal.normalized,
      isValidPhone: phoneVal.isValid,
      websiteStatus,
      source: 'CSV',
    });

    let rowStatus: ImportRowStatus = 'VALID';
    let included = true;

    if (dupCheck.status === 'DUPLICATE') {
      rowStatus = 'DUPLICATE';
      duplicateCount++;
      included = false; // Дубликаты по умолчанию исключены из импорта
    } else if (dupCheck.status === 'BRANCH') {
      rowStatus = 'BRANCH';
      branchCount++;
      included = true; // Филиалы разрешены по умолчанию (с предупреждением)
    } else {
      validCount++;
      included = true;
    }

    parsedRows.push({
      rowNumber,
      businessName: businessName.trim(),
      category: category.trim(),
      city: city.trim(),
      address: address?.trim(),
      phoneRaw: phoneRaw.trim(),
      phoneFormatted: phoneVal.normalized,
      isValidPhone: phoneVal.isValid,
      phoneError: phoneVal.error,
      websiteStatus,
      websiteUrl,
      notes: notes?.trim(),
      status: rowStatus,
      statusMessage: dupCheck.message,
      matchedLeadId: dupCheck.matchedLead?.id,
      included,
      score: scoreResult.score,
    });
  });

  return {
    fileName,
    totalRows: parsedRows.length,
    validCount,
    duplicateCount,
    branchCount,
    errorCount,
    rows: parsedRows,
  };
}

/**
 * Читает и парсит файл Excel (.xlsx) через read-excel-file
 */
export async function parseExcelFile(
  file: File,
  existingLeads: BusinessLead[]
): Promise<FileImportSummary> {
  const rawRows = await readSheet(file);
  const matrix: string[][] = rawRows.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
  );
  return processImportMatrix(matrix, existingLeads, file.name);
}

/**
 * Читает и парсит текстовый файл CSV
 */
export async function parseCsvFile(
  file: File,
  existingLeads: BusinessLead[]
): Promise<FileImportSummary> {
  const text = await file.text();
  const matrix = parseCsvToMatrix(text);
  return processImportMatrix(matrix, existingLeads, file.name);
}
