import type { BusinessLead, DiscoveredCompany, Language } from '../types';
import { generateWhatsAppLink, getDefaultMessage, createHistoryEvent } from './whatsapp';

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
 * Converts a DiscoveredCompany from 2GIS into a full BusinessLead ready for CRM and WhatsApp
 */
export function convertDiscoveredToLead(
  company: DiscoveredCompany,
  lang: Language = 'ru'
): BusinessLead {
  const now = new Date().toISOString();

  return {
    id: `lead-2gis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    businessName: company.name,
    category: company.category,
    phoneRaw: company.phoneRaw,
    phoneFormatted: company.phoneFormatted,
    isValidPhone: company.isValidPhone,
    phoneError: company.phoneError,
    city: company.city,
    address: company.address,
    websiteStatus: company.websiteStatus,
    websiteUrl: company.websiteUrl,
    externalUrl: company.externalUrl,
    externalId: company.id,
    source: '2GIS',
    language: lang,
    status: 'NEW',
    notes: company.address ? `Адрес из 2ГИС: ${company.address}` : undefined,
    history: [
      createHistoryEvent(
        'IMPORTED_FROM_2GIS',
        `Импортировано из официального каталога 2ГИС (${company.city}). Статус сайта: ${company.websiteStatus}`,
        undefined,
        'NEW'
      ),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Exports leads to CSV with UTF-8 BOM encoding for seamless Excel / Google Sheets compatibility
 */
export function exportLeadsToCsv(
  leads: BusinessLead[],
  filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const headers = [
    'ID',
    'Название компании',
    'Категория бизнеса',
    'Город',
    'Адрес',
    'Исходный телефон',
    'Телефон (E.164)',
    'Валидность телефона',
    'Статус сайта',
    'Ссылка на сайт',
    'Ссылка 2GIS',
    'Статус в CRM',
    'Язык шаблона',
    'Ссылка WhatsApp Click-to-Chat',
    'Заметки',
    'Дата добавления',
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

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

    return [
      lead.id,
      lead.businessName,
      lead.category,
      lead.city,
      lead.address || '',
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
    ].map(escapeCsv).join(';');
  });

  // Include UTF-8 BOM so Russian & Kazakh Cyrillic characters open properly in MS Excel
  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows].join('\r\n');

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
