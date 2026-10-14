import type { BusinessLead, DiscoveredCompany, Language } from '../types';
import { generateWhatsAppLink, getDefaultMessage, createHistoryEvent } from './whatsapp';
import { calculateLeadScore } from './scoring';

/**
 * Checks whether a company already exists in the CRM leads list
 * Checks by normalized phone number or by identical name + city
 */
export function isDuplicateLead(
  candidate: DiscoveredCompany,
  existingLeads: BusinessLead[]
): boolean {
  return existingLeads.some((lead) => {
    // Check by valid phone match
    if (
      candidate.isValidPhone &&
      lead.isValidPhone &&
      candidate.phoneFormatted &&
      lead.phoneFormatted &&
      candidate.phoneFormatted === lead.phoneFormatted
    ) {
      return true;
    }

    // Check by identical name and city
    const nameA = candidate.name.trim().toLowerCase();
    const nameB = lead.businessName.trim().toLowerCase();
    const cityA = candidate.city.trim().toLowerCase();
    const cityB = lead.city.trim().toLowerCase();

    return nameA === nameB && cityA === cityB;
  });
}

/**
 * Converts a DiscoveredCompany (from 2GIS or OpenStreetMap) into a full BusinessLead ready for CRM and WhatsApp
 */
export function convertDiscoveredToLead(
  company: DiscoveredCompany,
  lang: Language = 'ru'
): BusinessLead {
  const now = new Date().toISOString();
  const sourceName = company.source;
  const sourcesList = company.sources && company.sources.length > 1
    ? company.sources.map((s) => s.sourceName).join(', ')
    : sourceName;

  const historyDescription = company.sources && company.sources.length > 1
    ? `Импортировано из объединённых источников: ${sourcesList} (${company.city}). Статус сайта: ${company.websiteStatus}`
    : company.source === 'OSM'
    ? `Импортировано из OpenStreetMap (${company.city}). Источник: Overpass API. Статус сайта: ${company.websiteStatus}`
    : `Импортировано из ${company.source} (${company.city}). Статус сайта: ${company.websiteStatus}`;

  const historyType = company.source === 'OSM' ? 'IMPORTED_FROM_OSM' : 'IMPORTED_FROM_2GIS';

  const score = calculateLeadScore({
    businessName: company.name,
    category: company.category,
    phoneRaw: company.phoneRaw,
    phoneFormatted: company.phoneFormatted,
    isValidPhone: company.isValidPhone,
    city: company.city,
    address: company.address,
    coordinates: company.coordinates,
    websiteStatus: company.websiteStatus,
    source: company.source,
  });

  return {
    id: `lead-${company.source.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    businessName: company.name,
    category: company.category,
    phoneRaw: company.phoneRaw,
    phoneFormatted: company.phoneFormatted,
    isValidPhone: company.isValidPhone,
    phoneError: company.phoneError,
    city: company.city,
    address: company.address,
    coordinates: company.coordinates,
    websiteStatus: company.websiteStatus,
    websiteUrl: company.websiteUrl,
    externalUrl: company.externalUrl,
    externalId: company.id,
    source: company.source,
    sources: company.sources,
    duplicateFlag: company.duplicateFlag,
    mergedCount: company.mergedCount,
    fetchedAt: company.fetchedAt || now,
    language: lang,
    status: 'NEW',
    notes: company.address
      ? `Адрес из ${sourcesList}: ${company.address}`
      : undefined,
    score,
    history: [
      createHistoryEvent(
        historyType,
        historyDescription,
        undefined,
        'NEW'
      ),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Defense against CSV Formula Injection (CWE-1236)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM and formula injection protection
 */
export function generateCsvContent(leads: BusinessLead[]): string {
  const headers = [
    'ID',
    'Название компании',
    'Категория бизнеса',
    'Город',
    'Адрес',
    'Координаты (GPS)',
    'Источник данных',
    'Дата получения данных',
    'Исходный телефон',
    'Телефон (E.164)',
    'Валидность телефона',
    'Статус сайта',
    'Ссылка на сайт',
    'Ссылка на карточку (2GIS / OSM)',
    'Статус в CRM',
    'Язык шаблона',
    'Ссылка WhatsApp Click-to-Chat',
    'Заметки',
    'Дата добавления в CRM',
  ];

  const rows = leads.map((lead) => {
    let waLink = '';
    if (lead.isValidPhone) {
      try {
        const msg =
          lead.customMessage ||
          getDefaultMessage(lead.businessName, lead.category, lead.language);
        waLink = generateWhatsAppLink(lead.phoneFormatted, msg);
      } catch {}
    }

    const coordsStr = lead.coordinates
      ? `${lead.coordinates.lat}, ${lead.coordinates.lon}`
      : '';

    return [
      lead.id,
      lead.businessName,
      lead.category,
      lead.city,
      lead.address || '',
      coordsStr,
      lead.source || 'MANUAL',
      lead.fetchedAt || lead.createdAt,
      lead.phoneRaw,
      lead.phoneFormatted,
      lead.isValidPhone ? 'Да' : 'Нет',
      lead.websiteStatus === 'WEBSITE_LISTED' ? 'Сайт указан' : 'Сайт не указан (NO_WEBSITE_LISTED)',
      lead.websiteUrl || '',
      lead.externalUrl || '',
      lead.status,
      lead.language.toUpperCase(),
      waLink,
      lead.notes || '',
      lead.createdAt,
    ].map(escapeCsvValue).join(';');
  });

  // Include UTF-8 BOM so Russian & Kazakh Cyrillic characters open properly in MS Excel
  return '\uFEFF' + [headers.map(escapeCsvValue).join(';'), ...rows].join('\r\n');
}

/**
 * Exports leads to CSV with UTF-8 BOM encoding for seamless Excel / Google Sheets compatibility
 */
export function exportLeadsToCsv(
  leads: BusinessLead[],
  filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const csvContent = generateCsvContent(leads);

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
