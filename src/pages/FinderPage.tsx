import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  MapPin,
  Globe,
  ExternalLink,
  Plus,
  CheckCircle,
  AlertCircle,
  Key,
  Layers,
  CheckSquare,
  Square,
  ShieldCheck,
  Compass,
  RefreshCw,
  Clock,
  XCircle,
  Sparkles,
} from 'lucide-react';
import type {
  BusinessLead,
  DiscoveredCompany,
  KazakhstanCity,
  ProviderSearchStatus,
  SearchProviderId,
} from '../types';
import { KAZAKHSTAN_CITIES, BUSINESS_CATEGORIES } from '../data/kazakhstanData';
import { unifiedSearchEngine } from '../services/unifiedSearchEngine';
import {
  SEARCH_PROVIDERS,
  ALL_PROVIDER_IDS,
} from '../services/providers';
import { convertDiscoveredToLead } from '../utils/leadManagement';
import { formatPhoneForDisplay } from '../utils/whatsapp';
import { calculateLeadScore, getGradeLabel } from '../utils/scoring';

interface FinderPageProps {
  existingLeads: BusinessLead[];
  onImportLeads: (leads: BusinessLead[]) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const FinderPage: React.FC<FinderPageProps> = ({
  existingLeads,
  onImportLeads,
  onShowToast,
}) => {
  const navigate = useNavigate();

  // Multi-source selection: defaults to 2GIS and OSM
  const [selectedProviders, setSelectedProviders] = useState<Set<SearchProviderId>>(
    new Set(['2GIS', 'OSM'])
  );

  const [selectedCity, setSelectedCity] = useState<KazakhstanCity>(KAZAKHSTAN_CITIES[0]);
  const [selectedCategory, setSelectedCategory] = useState(BUSINESS_CATEGORIES[0].query);
  const [customQuery, setCustomQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<DiscoveredCompany[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderSearchStatus[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [totalFound, setTotalFound] = useState<number | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [filterWebsiteOnly, setFilterWebsiteOnly] = useState<'ALL' | 'NO_SITE' | 'HAS_SITE'>('ALL');
  const [fetchedAtTime, setFetchedAtTime] = useState<string | null>(null);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);

  const toggleProvider = (id: SearchProviderId) => {
    const next = new Set(selectedProviders);
    if (next.has(id)) {
      if (next.size === 1) {
        onShowToast('Необходимо выбрать хотя бы один источник поиска', 'info');
        return;
      }
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProviders(next);
  };

  const handleCancelSearch = () => {
    unifiedSearchEngine.cancelCurrentSearch();
    setIsLoading(false);
    onShowToast('Поиск остановлен пользователем', 'info');
  };

  const handleSearch = async () => {
    if (selectedProviders.size === 0) {
      onShowToast('Выберите хотя бы один источник данных', 'error');
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    setSelectedCompanyIds(new Set());
    setFetchedAtTime(null);
    setSearchDurationMs(null);

    const queryToUse = customQuery.trim() || selectedCategory;
    const osmFilter = BUSINESS_CATEGORIES.find((c) => c.query === selectedCategory)?.osmFilter;

    try {
      const result = await unifiedSearchEngine.searchAll(
        {
          city: selectedCity,
          categoryQuery: queryToUse,
          osmFilter,
          customQuery: customQuery.trim() || undefined,
          limit: 50,
          providers: Array.from(selectedProviders),
        },
        existingLeads,
        (pid, status) => {
          setProviderStatuses((prev) => {
            const next = prev.filter((p) => p.providerId !== pid);
            return [...next, status];
          });
        }
      );

      setSearchResults(result.companies);
      setTotalFound(result.totalUniqueFound);
      setProviderStatuses(result.providerStatuses);
      setFetchedAtTime(new Date().toLocaleTimeString('ru-RU'));
      setSearchDurationMs(result.durationMs);

      if (result.companies.length === 0) {
        onShowToast(`По запросу «${queryToUse}» в г. ${selectedCity.name} организаций не найдено`, 'info');
      } else {
        const mergedNote = result.stats.mergedCrossSource > 0
          ? ` (${result.stats.mergedCrossSource} объединено из разных источников)`
          : '';
        onShowToast(
          `Найдено ${result.companies.length} компаний в г. ${selectedCity.name}${mergedNote}`,
          'success'
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Unified search error:', err);
      setSearchError(err.message || 'Ошибка выполнения поиска');
      onShowToast(err.message || 'Ошибка поиска', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isAlreadyInCrm = (company: DiscoveredCompany) => {
    return company.duplicateFlag === 'EXACT_PHONE';
  };

  const toggleSelectCompany = (id: string) => {
    const next = new Set(selectedCompanyIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCompanyIds(next);
  };

  const handleSelectAllNew = () => {
    const newIds = new Set<string>();
    filteredResults.forEach((c) => {
      if (!isAlreadyInCrm(c)) {
        newIds.add(c.id);
      }
    });
    setSelectedCompanyIds(newIds);
  };

  const handleDeselectAll = () => {
    setSelectedCompanyIds(new Set());
  };

  const handleImportSingle = (company: DiscoveredCompany) => {
    if (isAlreadyInCrm(company)) {
      onShowToast(`Организация «${company.name}» уже добавлена в CRM`, 'info');
      return;
    }
    const lead = convertDiscoveredToLead(company, 'ru');
    onImportLeads([lead]);
    onShowToast(`«${company.name}» успешно добавлен в CRM!`, 'success');
  };

  const handleImportSelected = () => {
    const selectedCompanies = searchResults.filter((c) => selectedCompanyIds.has(c.id));
    if (selectedCompanies.length === 0) return;

    const nonDuplicates = selectedCompanies.filter((c) => !isAlreadyInCrm(c));
    if (nonDuplicates.length === 0) {
      onShowToast('Все выбранные компании уже присутствуют в CRM', 'info');
      return;
    }

    const newLeads = nonDuplicates.map((c) => convertDiscoveredToLead(c, 'ru'));
    onImportLeads(newLeads);
    onShowToast(`Импортировано ${newLeads.length} новых лидов в CRM!`, 'success');
    setSelectedCompanyIds(new Set());
    navigate('/leads');
  };

  const filteredResults = searchResults.filter((company) => {
    if (filterWebsiteOnly === 'NO_SITE') {
      return company.websiteStatus === 'NO_WEBSITE_LISTED';
    }
    if (filterWebsiteOnly === 'HAS_SITE') {
      return (
        company.websiteStatus === 'WEBSITE_LISTED' ||
        company.websiteStatus === 'VERIFIED' ||
        company.websiteStatus === 'FOUND_UNVERIFIED'
      );
    }
    return true;
  });

  const selectedCount = selectedCompanyIds.size;
  const newCandidatesCount = filteredResults.filter((c) => !isAlreadyInCrm(c)).length;

  return (
    <div className="finder-page-container">
      {/* Search Header Banner */}
      <div className="finder-header-card">
        <div className="finder-header-content">
          <div>
            <div className="finder-badge">
              <Compass size={14} color="#0284c7" />
              <span>Единый движок поиска • Multi-Source Lead Engine</span>
            </div>
            <h1 className="finder-title">Автоматический поиск организаций</h1>
            <p className="finder-subtitle">
              Параллельный сбор данных из официального каталога 2GIS, OpenStreetMap Overpass, Foursquare Places и Google Maps.
              Автоматическое объединение источников, распознавание филиалов и защита от дубликатов.
            </p>
          </div>

          <div className="finder-quick-stats">
            <div className="stat-pill">
              <span className="stat-num">{existingLeads.length}</span>
              <span className="stat-label">В вашей CRM</span>
            </div>
            {totalFound !== null && (
              <div className="stat-pill highlight">
                <span className="stat-num">{totalFound}</span>
                <span className="stat-label">Уникальных компаний</span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Source Provider Toggles */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Активные источники данных ({selectedProviders.size} из {ALL_PROVIDER_IDS.length}):</span>
          </div>

          <div className="source-provider-toggle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            {ALL_PROVIDER_IDS.map((pid) => {
              const provider = SEARCH_PROVIDERS[pid];
              const isSelected = selectedProviders.has(pid);
              const isConfigured = provider.isConfigured();

              return (
                <button
                  key={pid}
                  type="button"
                  className={`source-tab-btn ${isSelected ? `active-${pid.toLowerCase()}` : ''}`}
                  onClick={() => toggleProvider(pid)}
                  style={{
                    opacity: isSelected ? 1 : 0.6,
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  }}
                >
                  {pid === '2GIS' && <ShieldCheck size={18} color="#166534" />}
                  {pid === 'OSM' && <Layers size={18} color="#1d4ed8" />}
                  {pid === 'FOURSQUARE' && <MapPin size={18} color="#9d174d" />}
                  {pid === 'GOOGLE' && <Globe size={18} color="#b91c1c" />}

                  <div className="tab-btn-text">
                    <span className="tab-btn-title">{provider.name}</span>
                    <span className="tab-btn-desc">{provider.pricingNote}</span>
                  </div>

                  {provider.requiresApiKey ? (
                    isConfigured ? (
                      <span className="tab-badge-ok">Готов</span>
                    ) : (
                      <span
                        className="tab-badge-free"
                        style={{ background: '#fef3c7', color: '#92400e', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/settings');
                        }}
                        title="Нажмите, чтобы ввести API-ключ"
                      >
                        <Key size={10} style={{ display: 'inline', marginRight: 2 }} />
                        Нужен ключ
                      </span>
                    )
                  ) : (
                    <span className="tab-badge-free">Бесплатно</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider Live Status Chips Strip */}
        {providerStatuses.length > 0 && (
          <div className="provider-status-strip">
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Статус источников:</span>
            {providerStatuses.map((st) => {
              let icon = <CheckCircle size={12} color="#16a34a" />;
              let label = `${st.providerName}: ${st.totalFound} найдено`;

              if (st.status === 'loading') {
                icon = <RefreshCw size={12} className="animate-spin text-blue-600" />;
                label = `${st.providerName}: поиск...`;
              } else if (st.status === 'error') {
                icon = <AlertCircle size={12} color="#dc2626" />;
                label = `${st.providerName}: ${st.error || 'Ошибка'}`;
              } else if (st.status === 'not_configured') {
                icon = <Key size={12} color="#d97706" />;
                label = `${st.providerName}: не настроен`;
              } else if (st.status === 'empty') {
                icon = <Clock size={12} color="#64748b" />;
                label = `${st.providerName}: 0 найдено`;
              }

              if (st.durationMs) {
                label += ` (${st.durationMs}ms)`;
              }
              if (st.isFromCache) {
                label += ' [кэш]';
              }

              return (
                <span
                  key={st.providerId}
                  className={`provider-chip status-${st.status}`}
                  title={st.error || `${st.providerName} статус: ${st.status}`}
                >
                  {icon}
                  <span>{label}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Query Filter Toolbar */}
      <div className="finder-toolbar-card">
        <div className="toolbar-grid">
          {/* City Selector */}
          <div className="toolbar-field">
            <label className="toolbar-label">
              <MapPin size={14} />
              <span>Город Казахстана ({KAZAKHSTAN_CITIES.length})</span>
            </label>
            <select
              className="select-custom w-full"
              value={selectedCity.id}
              onChange={(e) => {
                const found = KAZAKHSTAN_CITIES.find((c) => c.id === e.target.value);
                if (found) setSelectedCity(found);
              }}
            >
              {KAZAKHSTAN_CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.nameKz})
                </option>
              ))}
            </select>
          </div>

          {/* Business Category */}
          <div className="toolbar-field">
            <label className="toolbar-label">
              <Building2 size={14} />
              <span>Сфера бизнеса</span>
            </label>
            <select
              className="select-custom w-full"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.query}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Query */}
          <div className="toolbar-field query-field">
            <label className="toolbar-label">
              <Search size={14} />
              <span>Уточняющий запрос (опционально)</span>
            </label>
            <input
              type="text"
              className="input-custom w-full"
              placeholder="например: барбершоп, ногти, детейлинг..."
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
            />
          </div>

          {/* Search Button / Cancel Button */}
          <div className="toolbar-field submit-field">
            {isLoading ? (
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handleCancelSearch}
                style={{
                  height: '40px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderColor: '#fca5a5',
                }}
              >
                <XCircle size={16} />
                <span>Отменить поиск</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={handleSearch}
                style={{
                  height: '40px',
                  backgroundColor: '#0284c7',
                }}
              >
                <Search size={16} />
                <span>Искать в {selectedCity.name}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Category Chips */}
        <div className="quick-category-chips">
          <span className="chips-label">Популярные ниши:</span>
          {BUSINESS_CATEGORIES.slice(0, 7).map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`chip-btn ${selectedCategory === cat.query ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(cat.query);
                setCustomQuery('');
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Area */}
      <div className="finder-results-section">
        {/* Results Header */}
        <div className="results-header-bar">
          <div className="results-info">
            <h2 className="results-title">
              Результаты поиска{' '}
              {totalFound !== null && (
                <span className="results-count">({filteredResults.length} из {totalFound})</span>
              )}
            </h2>
            {fetchedAtTime && (
              <div className="results-timestamp">
                <Clock size={13} />
                <span>Сбор завершён: {fetchedAtTime}</span>
                {searchDurationMs && <span>({searchDurationMs} мс)</span>}
              </div>
            )}
          </div>

          {/* Filter website only */}
          {searchResults.length > 0 && (
            <div className="results-filters-row">
              <div className="website-filter-group">
                <button
                  type="button"
                  className={`subfilter-btn ${filterWebsiteOnly === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterWebsiteOnly('ALL')}
                >
                  Все ({searchResults.length})
                </button>
                <button
                  type="button"
                  className={`subfilter-btn ${filterWebsiteOnly === 'NO_SITE' ? 'active' : ''}`}
                  onClick={() => setFilterWebsiteOnly('NO_SITE')}
                  title="Организации, у которых в источниках сайт не указан (целевые клиенты)"
                >
                  🎯 Без сайта (
                  {searchResults.filter((c) => c.websiteStatus === 'NO_WEBSITE_LISTED').length})
                </button>
                <button
                  type="button"
                  className={`subfilter-btn ${filterWebsiteOnly === 'HAS_SITE' ? 'active' : ''}`}
                  onClick={() => setFilterWebsiteOnly('HAS_SITE')}
                >
                  С сайтом (
                  {searchResults.filter((c) => c.websiteStatus !== 'NO_WEBSITE_LISTED').length})
                </button>
              </div>

              {/* Bulk actions */}
              <div className="bulk-actions-group">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectAllNew}
                  disabled={newCandidatesCount === 0}
                >
                  <CheckSquare size={14} />
                  <span>Выбрать новые ({newCandidatesCount})</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeselectAll}
                  disabled={selectedCount === 0}
                >
                  <Square size={14} />
                  <span>Снять выбор</span>
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleImportSelected}
                  disabled={selectedCount === 0}
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  <Plus size={15} />
                  <span>Импортировать в CRM ({selectedCount})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error notification */}
        {searchError && (
          <div className="error-banner">
            <AlertCircle size={20} color="#b91c1c" />
            <div style={{ flex: 1 }}>
              <strong>Ошибка при поиске:</strong> {searchError}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSearch}
              style={{ fontSize: '12px' }}
            >
              <RefreshCw size={12} />
              <span>Повторить</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="loading-card">
            <RefreshCw size={36} className="animate-spin text-blue-600" style={{ color: '#0284c7', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
              Параллельный опрос источников...
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Категория «{customQuery || selectedCategory}» в г. {selectedCity.name}
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCancelSearch}
              style={{ margin: '0 auto' }}
            >
              <XCircle size={14} />
              <span>Остановить поиск</span>
            </button>
          </div>
        )}

        {/* Empty State before search */}
        {!isLoading && searchResults.length === 0 && !searchError && (
          <div className="finder-empty-state">
            <Building2 size={48} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              Готовы к поиску потенциальных клиентов
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '540px', margin: '0 auto 20px' }}>
              Выберите город Казахстана, сферу бизнеса и нужные источники данных.
              Движок выполнит параллельный сбор, объединит дубликаты по номерам телефонов,
              распознает филиалы и присвоит каждой компании скоринговый рейтинг (A–D).
            </p>
            <button
              className="btn btn-primary"
              onClick={handleSearch}
            >
              <Search size={16} />
              <span>Запустить первый поиск</span>
            </button>
          </div>
        )}

        {/* Results Grid */}
        {!isLoading && filteredResults.length > 0 && (
          <div className="finder-results-grid">
            {filteredResults.map((company) => {
              const alreadyInCrm = isAlreadyInCrm(company);
              const isBranch = company.duplicateFlag === 'BRANCH';
              const isPossibleMatch = company.duplicateFlag === 'POSSIBLE_NAME_MATCH';
              const isSelected = selectedCompanyIds.has(company.id);

              const scoreRes = calculateLeadScore({
                businessName: company.name,
                category: company.category,
                city: company.city,
                address: company.address,
                phoneFormatted: company.phoneFormatted,
                isValidPhone: company.isValidPhone,
                websiteStatus: company.websiteStatus,
                source: company.source,
              });
              const gradeInfo = getGradeLabel(scoreRes.grade);

              const isMulti = company.sources && company.sources.length > 1;
              const sourceLabel = isMulti
                ? company.sources!.map((s) => s.sourceName).join(' + ')
                : company.source === '2GIS'
                ? '2GIS'
                : company.source === 'OSM'
                ? '🗺️ OSM'
                : company.source;

              return (
                <div
                  key={company.id}
                  className={`finder-item-card ${isSelected ? 'selected' : ''} ${alreadyInCrm ? 'in-crm' : ''}`}
                >
                  <div className="finder-card-header">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyInCrm}
                        onChange={() => toggleSelectCompany(company.id)}
                        style={{ marginTop: 4, cursor: alreadyInCrm ? 'not-allowed' : 'pointer' }}
                      />
                      <div>
                        <h3 className="finder-company-name">{company.name}</h3>
                        <div className="finder-meta-row">
                          <span className="tag-category">{company.category}</span>
                          <span className="tag-city">{company.city}</span>

                          {isMulti ? (
                            <span
                              className="source-pill source-multi"
                              title={`Объединено из ${company.sources!.length} источников: ${sourceLabel}`}
                            >
                              <Sparkles size={10} style={{ display: 'inline', marginRight: 2 }} />
                              {sourceLabel}
                            </span>
                          ) : (
                            <span className={`source-pill source-${company.source.toLowerCase()}`}>
                              {sourceLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {alreadyInCrm ? (
                        <span className="badge-crm-exists">
                          <CheckCircle size={12} />
                          <span>Уже в CRM</span>
                        </span>
                      ) : isBranch ? (
                        <span className="badge-branch" title="Филиал известной сети с другим адресом или телефоном">
                          🏢 Филиал сети
                        </span>
                      ) : isPossibleMatch ? (
                        <span className="badge-possible-match" title="Похожее название найдено в CRM">
                          🔍 Совпадение
                        </span>
                      ) : (
                        <span className={`score-badge ${gradeInfo.badgeClass}`}>
                          {gradeInfo.emoji} {scoreRes.score}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Address and Website */}
                  <div className="finder-card-body">
                    {company.address && (
                      <div className="finder-detail-row">
                        <MapPin size={13} color="#64748b" />
                        <span>{company.address}</span>
                      </div>
                    )}

                    <div className="finder-detail-row">
                      <Globe size={13} color="#64748b" />
                      {company.websiteStatus === 'WEBSITE_LISTED' && company.websiteUrl ? (
                        <a
                          href={company.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-website-present"
                        >
                          {company.websiteUrl.replace(/^https?:\/\//, '').split('/')[0]}
                          <ExternalLink size={11} style={{ display: 'inline', marginLeft: 4 }} />
                        </a>
                      ) : (
                        <span className="badge-no-website">
                          Сайт не указан (NO_WEBSITE_LISTED)
                        </span>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="finder-detail-row">
                      <span style={{ fontWeight: 600, color: '#475569', fontSize: '11px' }}>Тел:</span>
                      {company.isValidPhone ? (
                        <span className="phone-valid">
                          {formatPhoneForDisplay(company.phoneFormatted)}
                        </span>
                      ) : (
                        <span className="phone-invalid">
                          {company.phoneRaw || 'Телефон не указан'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="finder-card-footer">
                    {company.externalUrl && (
                      <a
                        href={company.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-link-external"
                        title="Открыть карточку в источнике"
                      >
                        <ExternalLink size={13} />
                        <span>Карточка</span>
                      </a>
                    )}

                    {!alreadyInCrm ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleImportSingle(company)}
                      >
                        <Plus size={14} />
                        <span>Добавить в CRM</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        ✓ Сохранено
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
