import type {
  BusinessLead,
  DiscoveredCompany,
  LeadSourceMetadata,
} from '../types';

export interface DeduplicationStats {
  incomingTotal: number;
  mergedCrossSource: number;
  identifiedBranches: number;
  alreadyInCrmCount: number;
  newUniqueCount: number;
}

const LEGAL_FORMS = new Set(['тоо', 'ип', 'ао', 'llp', 'llc', 'ltd', 'пао', 'тооо', 'чп']);

/**
 * Normalizes company business name for robust comparison
 * Removes legal forms (ТОО, ИП, ТООО, АО, LLP, LLC), punctuation, extra spaces
 */
export function normalizeName(rawName: string): string {
  if (!rawName) return '';
  const cleaned = rawName
    .toLowerCase()
    .replace(/[«»""''`’()[\]{}_-]/g, ' ');

  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !LEGAL_FORMS.has(t));

  return tokens.join(' ');
}

/**
 * Computes token overlap (Jaccard similarity) between two company names
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = new Set(normA.split(' ').filter((w) => w.length > 1));
  const tokensB = new Set(normB.split(' ').filter((w) => w.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return normA.includes(normB) || normB.includes(normA) ? 0.7 : 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalizes street address for branch differentiation
 */
export function normalizeAddress(rawAddress?: string): string {
  if (!rawAddress) return '';
  return rawAddress
    .toLowerCase()
    .replace(/\b(город|г\.|ул\.|улица|просп\.|проспект|пр\.|мкр\.|микрорайон|д\.|дом|корп\.|корпус|стр\.|строение|вп\.|вп)\b/gi, ' ')
    .replace(/[,\s]+/g, ' ')
    .trim();
}

/**
 * Checks whether two entries represent different branches of the same business chain
 */
export function isDifferentBranch(
  a: { name: string; city: string; address?: string; phoneFormatted?: string },
  b: { name: string; city: string; address?: string; phoneFormatted?: string }
): boolean {
  if (a.city.trim().toLowerCase() !== b.city.trim().toLowerCase()) {
    return false;
  }

  const similarity = calculateNameSimilarity(a.name, b.name);
  if (similarity < 0.6) {
    return false;
  }

  // If phones are valid and identical, they might share a single call-center,
  // but if addresses are distinctly different, they are different physical branches!
  const addrA = normalizeAddress(a.address);
  const addrB = normalizeAddress(b.address);

  if (addrA && addrB && addrA !== addrB) {
    return true;
  }

  // If phones are both present and different, and addresses are missing or different
  if (
    a.phoneFormatted &&
    b.phoneFormatted &&
    a.phoneFormatted !== b.phoneFormatted &&
    addrA !== addrB
  ) {
    return true;
  }

  return false;
}

/**
 * Merges two discovered companies from different sources into a consolidated record
 */
export function mergeDiscoveredCompanies(
  primary: DiscoveredCompany,
  secondary: DiscoveredCompany
): DiscoveredCompany {
  // Combine sources metadata
  const existingSources: LeadSourceMetadata[] = [
    ...(primary.sources || []),
    ...(secondary.sources || []),
  ];

  // De-duplicate sources list by sourceId + externalId
  const uniqueSourcesMap = new Map<string, LeadSourceMetadata>();
  for (const s of existingSources) {
    const key = `${s.sourceId}_${s.externalId || s.originalName}`;
    if (!uniqueSourcesMap.has(key)) {
      uniqueSourcesMap.set(key, s);
    }
  }
  const mergedSources = Array.from(uniqueSourcesMap.values());

  // Determine phone (prefer primary if valid, else secondary)
  const phoneFormatted =
    (primary.isValidPhone ? primary.phoneFormatted : secondary.phoneFormatted) ||
    primary.phoneFormatted;
  const phoneRaw =
    (primary.isValidPhone ? primary.phoneRaw : secondary.phoneRaw) ||
    primary.phoneRaw;
  const isValidPhone = primary.isValidPhone || secondary.isValidPhone;
  const phoneError = isValidPhone
    ? undefined
    : primary.phoneError || secondary.phoneError;

  // Determine website
  const websiteUrl = primary.websiteUrl || secondary.websiteUrl;
  const websiteStatus =
    primary.websiteStatus === 'WEBSITE_LISTED' ||
    secondary.websiteStatus === 'WEBSITE_LISTED'
      ? 'WEBSITE_LISTED'
      : primary.websiteStatus;

  // Determine address & coordinates
  const address =
    primary.address && primary.address.length > (secondary.address?.length || 0)
      ? primary.address
      : secondary.address || primary.address;

  const coordinates = primary.coordinates || secondary.coordinates;

  // Multi-source source indicator
  const hasMultipleSources = mergedSources.length > 1;
  const source = hasMultipleSources ? ('MULTI' as const) : primary.source;

  return {
    ...primary,
    address,
    coordinates,
    phoneRaw,
    phoneFormatted,
    isValidPhone,
    phoneError,
    websiteUrl,
    websiteStatus,
    source,
    sources: mergedSources,
    mergedCount: (primary.mergedCount || 1) + (secondary.mergedCount || 1),
    confidenceScore: Math.min(
      100,
      Math.max(primary.confidenceScore || 85, secondary.confidenceScore || 85) + 10
    ),
  };
}

/**
 * Consolidates incoming batch from multiple providers:
 * 1. Merges entries with matching valid phone numbers & compatible names/cities
 * 2. Tags distinct branches of the same chain as 'BRANCH'
 * 3. Tags ambiguous name matches without phone as 'POSSIBLE_NAME_MATCH'
 */
export function consolidateDiscoveredBatch(
  incoming: DiscoveredCompany[]
): { companies: DiscoveredCompany[]; stats: { mergedCount: number; branchCount: number } } {
  let mergedCount = 0;
  let branchCount = 0;

  const consolidated: DiscoveredCompany[] = [];

  for (const candidate of incoming) {
    let matchedIndex = -1;
    let isBranch = false;

    for (let i = 0; i < consolidated.length; i++) {
      const existing = consolidated[i];

      // Must be same city
      if (candidate.city.trim().toLowerCase() !== existing.city.trim().toLowerCase()) {
        continue;
      }

      // 1. Strong Phone Match
      if (
        candidate.isValidPhone &&
        existing.isValidPhone &&
        candidate.phoneFormatted === existing.phoneFormatted
      ) {
        // Check if names are compatible
        const similarity = calculateNameSimilarity(candidate.name, existing.name);
        if (similarity >= 0.4 || !existing.name || !candidate.name) {
          // Reliable match between sources!
          matchedIndex = i;
          break;
        }
      }

      // 2. Name & City check for branches
      if (isDifferentBranch(candidate, existing)) {
        isBranch = true;
        // Don't break, keep checking if there's an exact phone match with another entry
      }
    }

    if (matchedIndex >= 0) {
      // Merge records
      consolidated[matchedIndex] = mergeDiscoveredCompanies(
        consolidated[matchedIndex],
        candidate
      );
      mergedCount++;
    } else {
      const item: DiscoveredCompany = {
        ...candidate,
        duplicateFlag: isBranch ? 'BRANCH' : candidate.duplicateFlag || null,
      };
      if (isBranch) {
        branchCount++;
      }
      consolidated.push(item);
    }
  }

  return {
    companies: consolidated,
    stats: { mergedCount, branchCount },
  };
}

/**
 * Correlates discovered companies against the existing CRM leads database:
 * - EXACT_PHONE: already in CRM with exact phone number
 * - BRANCH: same brand name + city in CRM, but different address
 * - POSSIBLE_NAME_MATCH: identical brand name + city, but phones cannot be verified
 */
export function correlateWithCrm(
  discovered: DiscoveredCompany[],
  existingLeads: BusinessLead[]
): {
  annotated: DiscoveredCompany[];
  stats: DeduplicationStats;
} {
  let alreadyInCrmCount = 0;
  let branchCount = 0;
  let newUniqueCount = 0;

  const annotated = discovered.map((company) => {
    let duplicateFlag: 'EXACT_PHONE' | 'POSSIBLE_NAME_MATCH' | 'BRANCH' | null = null;
    let matchedLeadId: string | undefined = undefined;

    for (const lead of existingLeads) {
      // Same city check
      if (company.city.trim().toLowerCase() !== lead.city.trim().toLowerCase()) {
        continue;
      }

      // Check phone match
      if (
        company.isValidPhone &&
        lead.isValidPhone &&
        company.phoneFormatted === lead.phoneFormatted
      ) {
        duplicateFlag = 'EXACT_PHONE';
        matchedLeadId = lead.id;
        break;
      }

      // Check branch match
      if (
        isDifferentBranch(
          {
            name: company.name,
            city: company.city,
            address: company.address,
            phoneFormatted: company.phoneFormatted,
          },
          {
            name: lead.businessName,
            city: lead.city,
            address: lead.address,
            phoneFormatted: lead.phoneFormatted,
          }
        )
      ) {
        duplicateFlag = 'BRANCH';
        matchedLeadId = lead.id;
      } else if (
        !duplicateFlag &&
        calculateNameSimilarity(company.name, lead.businessName) >= 0.8
      ) {
        // Same name and city, no matching phone
        duplicateFlag = 'POSSIBLE_NAME_MATCH';
        matchedLeadId = lead.id;
      }
    }

    if (duplicateFlag === 'EXACT_PHONE') {
      alreadyInCrmCount++;
    } else if (duplicateFlag === 'BRANCH') {
      branchCount++;
    } else {
      newUniqueCount++;
    }

    return {
      ...company,
      duplicateFlag: duplicateFlag || company.duplicateFlag || null,
      possibleDuplicateOf: matchedLeadId,
    };
  });

  return {
    annotated,
    stats: {
      incomingTotal: discovered.length,
      mergedCrossSource: 0,
      identifiedBranches: branchCount,
      alreadyInCrmCount,
      newUniqueCount,
    },
  };
}

/**
 * Synchronizes an existing CRM lead with newly discovered information
 * GUARANTEE: Never overwrites fields modified by the user (userEditedFields)!
 * GUARANTEE: Never changes status (especially DO_NOT_CONTACT)!
 */
export function syncLeadWithIncoming(
  existing: BusinessLead,
  incoming: DiscoveredCompany
): BusinessLead {
  const userEdited = new Set(existing.userEditedFields || []);
  const now = new Date().toISOString();

  // Combine source provenance
  const existingSources = existing.sources || [];
  const incomingSources = incoming.sources || [
    {
      sourceId: incoming.source,
      sourceName: incoming.source,
      externalId: incoming.id,
      externalUrl: incoming.externalUrl,
      fetchedAt: incoming.fetchedAt || now,
      originalName: incoming.name,
      originalAddress: incoming.address,
      originalPhone: incoming.phoneRaw,
      originalWebsite: incoming.websiteUrl,
    },
  ];

  const mergedSourcesMap = new Map<string, LeadSourceMetadata>();
  for (const s of [...existingSources, ...incomingSources]) {
    mergedSourcesMap.set(`${s.sourceId}_${s.externalId || s.originalName}`, s);
  }

  // Preserve user edits
  const updated: BusinessLead = {
    ...existing,
    sources: Array.from(mergedSourcesMap.values()),
    updatedAt: now,
  };

  if (!userEdited.has('businessName') && (!existing.businessName || existing.businessName.length < incoming.name.length)) {
    updated.businessName = incoming.name;
  }

  if (!userEdited.has('address') && !existing.address && incoming.address) {
    updated.address = incoming.address;
  }

  if (!userEdited.has('coordinates') && !existing.coordinates && incoming.coordinates) {
    updated.coordinates = incoming.coordinates;
  }

  if (!userEdited.has('websiteUrl') && !existing.websiteUrl && incoming.websiteUrl) {
    updated.websiteUrl = incoming.websiteUrl;
    updated.websiteStatus = incoming.websiteStatus;
  }

  if (!userEdited.has('phoneFormatted') && !existing.isValidPhone && incoming.isValidPhone) {
    updated.phoneRaw = incoming.phoneRaw;
    updated.phoneFormatted = incoming.phoneFormatted;
    updated.isValidPhone = incoming.isValidPhone;
    updated.phoneError = incoming.phoneError;
  }

  return updated;
}
