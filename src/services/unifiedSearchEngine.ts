import type {
  BusinessLead,
  DiscoveredCompany,
  ProviderSearchStatus,
  SearchProviderId,
} from '../types';
import {
  SEARCH_PROVIDERS,
  type LeadSearchQuery,
} from './providers';
import {
  consolidateDiscoveredBatch,
  correlateWithCrm,
  type DeduplicationStats,
} from './deduplicationEngine';

export interface UnifiedSearchResult {
  companies: DiscoveredCompany[];
  totalRawFound: number;
  totalUniqueFound: number;
  providerStatuses: ProviderSearchStatus[];
  stats: DeduplicationStats;
  durationMs: number;
  isPartial: boolean;
  hasErrors: boolean;
}

class UnifiedLeadSearchEngine {
  private activeAbortController: AbortController | null = null;
  private currentSearchId = 0;

  /**
   * Cancels any ongoing multi-source search
   */
  cancelCurrentSearch(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Performs an asynchronous unified search across all requested providers
   */
  async searchAll(
    query: LeadSearchQuery,
    existingLeads: BusinessLead[],
    onProgress?: (providerId: SearchProviderId, status: ProviderSearchStatus) => void
  ): Promise<UnifiedSearchResult> {
    // Cancel previous search if active
    this.cancelCurrentSearch();

    const searchId = ++this.currentSearchId;
    const controller = new AbortController();
    this.activeAbortController = controller;

    const startTime = performance.now();
    const providerIds = query.providers.length > 0 ? query.providers : (['2GIS', 'OSM'] as SearchProviderId[]);

    // Initialize statuses
    const statusesMap = new Map<SearchProviderId, ProviderSearchStatus>();
    for (const pid of providerIds) {
      const provider = SEARCH_PROVIDERS[pid];
      const isConf = provider ? provider.isConfigured() : false;

      const initialStatus: ProviderSearchStatus = {
        providerId: pid,
        providerName: provider ? provider.name : pid,
        status: isConf ? 'loading' : 'not_configured',
        totalFound: 0,
        requiresKey: provider ? provider.requiresApiKey : false,
        isConfigured: isConf,
      };

      if (!isConf && provider?.requiresApiKey) {
        initialStatus.error = `API-ключ не настроен. Нажмите «Настройки», чтобы указать ключ.`;
      }

      statusesMap.set(pid, initialStatus);
      if (onProgress) {
        onProgress(pid, initialStatus);
      }
    }

    // Run provider queries in parallel using Promise.allSettled
    const providerPromises = providerIds.map(async (pid) => {
      const provider = SEARCH_PROVIDERS[pid];
      if (!provider) return { pid, companies: [], total: 0, error: `Провайдер ${pid} не найден` };

      if (!provider.isConfigured() && provider.requiresApiKey) {
        const status = statusesMap.get(pid)!;
        status.status = 'not_configured';
        status.error = `API-ключ не настроен`;
        if (onProgress) onProgress(pid, status);
        return { pid, companies: [], total: 0, error: status.error };
      }

      const pStartTime = performance.now();

      try {
        const res = await provider.search(query, controller.signal);

        // Check if aborted or superseded
        if (controller.signal.aborted || this.currentSearchId !== searchId) {
          throw new DOMException('Search aborted', 'AbortError');
        }

        const pDuration = Math.round(performance.now() - pStartTime);
        const status = statusesMap.get(pid)!;
        status.durationMs = pDuration;
        status.totalFound = res.companies.length;
        status.isFromCache = res.isFromCache;

        if (res.error && res.companies.length === 0) {
          status.status = 'error';
          status.error = res.error;
        } else if (res.companies.length === 0) {
          status.status = 'empty';
        } else {
          status.status = 'success';
        }

        if (onProgress) {
          onProgress(pid, status);
        }

        return {
          pid,
          companies: res.companies,
          total: res.total,
          error: res.error,
        };
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          throw err;
        }

        const pDuration = Math.round(performance.now() - pStartTime);
        const status = statusesMap.get(pid)!;
        status.status = 'error';
        status.durationMs = pDuration;
        status.error = err.message || 'Ошибка выполнения запроса';

        if (onProgress) {
          onProgress(pid, status);
        }

        return {
          pid,
          companies: [],
          total: 0,
          error: status.error,
        };
      }
    });

    const settledResults = await Promise.allSettled(providerPromises);

    // If aborted or superseded, throw abort
    if (controller.signal.aborted || this.currentSearchId !== searchId) {
      throw new DOMException('Search aborted', 'AbortError');
    }

    const allDiscovered: DiscoveredCompany[] = [];
    let hasErrors = false;
    let hasSuccess = false;

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        allDiscovered.push(...settled.value.companies);
        if (settled.value.companies.length > 0) {
          hasSuccess = true;
        }
        if (settled.value.error) {
          hasErrors = true;
        }
      } else {
        hasErrors = true;
      }
    }

    // Pipeline: Deduplicate across sources & identify branches
    const consolidated = consolidateDiscoveredBatch(allDiscovered);

    // Pipeline: Correlate with CRM leads
    const correlated = correlateWithCrm(consolidated.companies, existingLeads);

    const durationMs = Math.round(performance.now() - startTime);

    const statuses = Array.from(statusesMap.values());
    const isPartial = hasErrors && hasSuccess;

    return {
      companies: correlated.annotated,
      totalRawFound: allDiscovered.length,
      totalUniqueFound: correlated.annotated.length,
      providerStatuses: statuses,
      stats: {
        incomingTotal: allDiscovered.length,
        mergedCrossSource: consolidated.stats.mergedCount,
        identifiedBranches: consolidated.stats.branchCount,
        alreadyInCrmCount: correlated.stats.alreadyInCrmCount,
        newUniqueCount: correlated.stats.newUniqueCount,
      },
      durationMs,
      isPartial,
      hasErrors,
    };
  }
}

export const unifiedSearchEngine = new UnifiedLeadSearchEngine();
