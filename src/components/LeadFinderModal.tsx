import React, { useState } from 'react';
import {
  X,
  Search,
  Building2,
  MapPin,
  Phone,
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
} from 'lucide-react';
import type { BusinessLead, DiscoveredCompany, KazakhstanCity, SearchProvider } from '../types';
import { KAZAKHSTAN_CITIES, BUSINESS_CATEGORIES } from '../data/kazakhstanData';
import {
  searchTwoGisCompanies,
  getStoredTwoGisApiKey,
} from '../services/twoGisService';
import { searchOverpassCompanies } from '../services/overpassService';
import { isDuplicateLead, convertDiscoveredToLead } from '../utils/leadManagement';
import { formatPhoneForDisplay } from '../utils/whatsapp';

interface LeadFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLeads: BusinessLead[];
  onImportLeads: (leads: BusinessLead[]) => void;
  onOpenKeyModal: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const LeadFinderModal: React.FC<LeadFinderModalProps> = ({
  isOpen,
  onClose,
  existingLeads,
  onImportLeads,
  onOpenKeyModal,
  onShowToast,
}) => {
  const [sourceProvider, setSourceProvider] = useState<SearchProvider>('2GIS');
  const [selectedCity, setSelectedCity] = useState<KazakhstanCity>(KAZAKHSTAN_CITIES[0]);
  const [selectedCategory, setSelectedCategory] = useState(BUSINESS_CATEGORIES[0].query);
  const [customQuery, setCustomQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<DiscoveredCompany[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [totalFound, setTotalFound] = useState<number | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [filterWebsiteOnly, setFilterWebsiteOnly] = useState<'ALL' | 'NO_SITE' | 'HAS_SITE'>('ALL');
  const [isFromCache, setIsFromCache] = useState(false);
  const [fetchedAtTime, setFetchedAtTime] = useState<string | null>(null);

  if (!isOpen) return null;

  const apiKey = getStoredTwoGisApiKey();

  const handleSearch = async (forceRefresh = false) => {
    setIsLoading(true);
    setSearchError(null);
    setSelectedCompanyIds(new Set());
    setIsFromCache(false);

    const activeCat = BUSINESS_CATEGORIES.find((c) => c.query === selectedCategory);
    const queryToUse = customQuery.trim() || selectedCategory;

    if (sourceProvider === '2GIS') {
      if (!apiKey) {
        setIsLoading(false);
        onShowToast('Необходимо настроить 2GIS API-ключ перед поиском', 'error');
        onOpenKeyModal();
        return;
      }

      try {
        const result = await searchTwoGisCompanies({
          apiKey,
          query: queryToUse,
          cityName: selectedCity.name,
          regionId: selectedCity.regionId,
          page: 1,
          pageSize: 50,
        });

        if (result.error) {
          setSearchError(result.error);
          setSearchResults([]);
          setTotalFound(0);
          onShowToast(`Ошибка 2GIS: ${result.error}`, 'error');
        } else {
          setSearchResults(result.companies);
          setTotalFound(result.total);
          setFetchedAtTime(new Date().toISOString());
          if (result.companies.length === 0) {
            onShowToast('Организации в 2ГИС по запросу не найдены', 'info');
          } else {
            onShowToast(`Найдено ${result.companies.length} организаций в 2ГИС`, 'success');
          }
        }
      } catch (e: any) {
        setSearchError(e.message || 'Ошибка выполнения поиска в 2GIS');
        onShowToast('Сетевая ошибка при поиске 2GIS', 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      // OpenStreetMap via Overpass API
      try {
        const result = await searchOverpassCompanies({
          city: selectedCity,
          categoryQuery: queryToUse,
          osmFilter: customQuery.trim() ? undefined : activeCat?.osmFilter,
          limit: 50,
          forceRefresh,
        });

        if (result.error) {
          setSearchError(result.error);
          setSearchResults([]);
          setTotalFound(0);
          onShowToast(`Ошибка OpenStreetMap: ${result.error}`, 'error');
        } else {
          setSearchResults(result.companies);
          setTotalFound(result.total);
          setIsFromCache(result.isFromCache);
          setFetchedAtTime(result.fetchedAt);

          if (result.companies.length === 0) {
            onShowToast('Организации в OpenStreetMap по запросу не найдены', 'info');
          } else {
            onShowToast(
              `Найдено ${result.companies.length} организаций в OSM${result.isFromCache ? ' (из кеша)' : ''}`,
              'success'
            );
          }
        }
      } catch (e: any) {
        setSearchError(e.message || 'Ошибка поиска в OpenStreetMap');
        onShowToast('Сетевая ошибка при обращении к OpenStreetMap', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isAlreadyInCrm = (company: DiscoveredCompany) => {
    return isDuplicateLead(company, existingLeads);
  };

  // Toggle selection for batch import
  const toggleSelect = (id: string) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllNew = () => {
    const newItems = displayedCompanies.filter((c) => !isAlreadyInCrm(c));
    setSelectedCompanyIds(new Set(newItems.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCompanyIds(new Set());
  };

  // Single Import
  const handleImportSingle = (company: DiscoveredCompany) => {
    if (isAlreadyInCrm(company)) {
      onShowToast(`Организация «${company.name}» уже присутствует в CRM`, 'info');
      return;
    }

    const newLead = convertDiscoveredToLead(company, 'ru');
    onImportLeads([newLead]);
    onShowToast(`«${company.name}» (${company.source}) добавлена в CRM!`, 'success');
  };

  // Batch Import
  const handleImportSelected = () => {
    const selectedCompanies = searchResults.filter((c) => selectedCompanyIds.has(c.id));
    if (selectedCompanies.length === 0) {
      onShowToast('Выберите организации для импорта', 'info');
      return;
    }

    const nonDuplicates = selectedCompanies.filter((c) => !isAlreadyInCrm(c));
    if (nonDuplicates.length === 0) {
      onShowToast('Все выбранные организации уже есть в CRM', 'info');
      return;
    }

    const newLeads = nonDuplicates.map((c) => convertDiscoveredToLead(c, 'ru'));
    onImportLeads(newLeads);
    onShowToast(`Импортировано в CRM: ${newLeads.length} организаций!`, 'success');
    setSelectedCompanyIds(new Set());
  };

  // Filtered displayed list
  const displayedCompanies = searchResults.filter((company) => {
    if (filterWebsiteOnly === 'NO_SITE' && company.websiteStatus !== 'NO_WEBSITE_LISTED') {
      return false;
    }
    if (filterWebsiteOnly === 'HAS_SITE' && company.websiteStatus !== 'WEBSITE_LISTED') {
      return false;
    }
    return true;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '1020px', width: '96vw', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={22} color="#0284c7" />
              <span>Поиск потенциальных клиентов по Казахстану</span>
            </h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
              Выбор источника данных (2GIS / OpenStreetMap), проверка наличия сайта и подключение к WhatsApp Click-to-Chat
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Source Provider Switcher (2GIS vs OpenStreetMap) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f1f5f9',
            padding: '8px 12px',
            borderRadius: '10px',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Источник данных:</span>
            <div className="lang-selector">
              <button
                type="button"
                className={`lang-btn ${sourceProvider === '2GIS' ? 'active' : ''}`}
                onClick={() => {
                  setSourceProvider('2GIS');
                  setSearchResults([]);
                  setSearchError(null);
                }}
                style={{ padding: '5px 12px', fontSize: '12.5px' }}
              >
                🏢 2GIS API (Каталог 3.0)
              </button>
              <button
                type="button"
                className={`lang-btn ${sourceProvider === 'OSM' ? 'active' : ''}`}
                onClick={() => {
                  setSourceProvider('OSM');
                  setSearchResults([]);
                  setSearchError(null);
                }}
                style={{ padding: '5px 12px', fontSize: '12.5px' }}
              >
                🗺️ OpenStreetMap (Overpass API)
              </button>
            </div>
          </div>

          {/* Provider status label */}
          <div>
            {sourceProvider === '2GIS' ? (
              apiKey ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#166534' }}>
                  <ShieldCheck size={14} color="#16a34a" />
                  <span>2GIS ключ активен</span>
                  <button type="button" className="text-btn" onClick={onOpenKeyModal} style={{ fontSize: '11px' }}>
                    Изменить
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#b45309' }}>
                  <AlertCircle size={14} />
                  <span>Ключ 2GIS не настроен</span>
                  <button type="button" className="text-btn" onClick={onOpenKeyModal} style={{ fontSize: '11px', color: '#0284c7' }}>
                    Настроить
                  </button>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#1e40af' }}>
                <Compass size={14} color="#2563eb" />
                <span>OpenStreetMap • Без ключа API (ODbL) • Кеширование 15 мин</span>
              </div>
            )}
          </div>
        </div>

        {/* 2GIS Warning if needed */}
        {sourceProvider === '2GIS' && !apiKey && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12.5px', color: '#92400e' }}>
              <AlertCircle size={16} />
              <span>
                <strong>2GIS API-ключ не настроен.</strong> Вы можете переключиться на <strong>OpenStreetMap</strong> (работает без ключа) или настроить ключ 2GIS.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onOpenKeyModal}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Key size={13} />
              <span>Настроить ключ</span>
            </button>
          </div>
        )}

        {/* Search Parameters Form */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr auto', gap: 10, alignItems: 'end' }}>
            {/* City */}
            <div>
              <label className="form-label" style={{ fontSize: '12.5px', marginBottom: 4 }}>
                <MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Город Казахстана:
              </label>
              <select
                className="form-input"
                value={selectedCity.id}
                onChange={(e) => {
                  const city = KAZAKHSTAN_CITIES.find((c) => c.id === e.target.value);
                  if (city) setSelectedCity(city);
                }}
              >
                {KAZAKHSTAN_CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} ({city.nameKz})
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="form-label" style={{ fontSize: '12.5px', marginBottom: 4 }}>
                <Layers size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Сфера / Категория бизнеса:
              </label>
              <select
                className="form-input"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCustomQuery('');
                }}
              >
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.query}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Query */}
            <div>
              <label className="form-label" style={{ fontSize: '12.5px', marginBottom: 4 }}>
                Или свой поисковый запрос:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Например: автосервис, пицца"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSearch(false)}
                disabled={isLoading}
                style={{ padding: '9px 18px', backgroundColor: sourceProvider === 'OSM' ? '#2563eb' : '#0284c7' }}
              >
                <Search size={16} />
                <span>{isLoading ? 'Поиск...' : 'Найти'}</span>
              </button>

              {sourceProvider === 'OSM' && searchResults.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleSearch(true)}
                  disabled={isLoading}
                  title="Обновить данные с сервера Overpass (без кеша)"
                  style={{ padding: '9px 12px' }}
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {searchError && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '13px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{searchError}</span>
          </div>
        )}

        {/* Search Results Summary & Controls */}
        {searchResults.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                Источник: <strong>{sourceProvider}</strong> • Найдено: {searchResults.length}
                {totalFound && totalFound > searchResults.length ? ` (всего ${totalFound})` : ''}
              </span>

              {/* Cache and Timestamp Indicator (Requirement: "Показывай источник и дату получения данных") */}
              {fetchedAtTime && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  <Clock size={11} />
                  <span>
                    {new Date(fetchedAtTime).toLocaleTimeString('ru-RU')}
                    {isFromCache ? ' (из кеша)' : ' (с сервера)'}
                  </span>
                </span>
              )}

              {/* Website Filter Tabs */}
              <div className="lang-selector">
                <button
                  type="button"
                  className={`lang-btn ${filterWebsiteOnly === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterWebsiteOnly('ALL')}
                >
                  Все ({searchResults.length})
                </button>
                <button
                  type="button"
                  className={`lang-btn ${filterWebsiteOnly === 'NO_SITE' ? 'active' : ''}`}
                  onClick={() => setFilterWebsiteOnly('NO_SITE')}
                  title="Компании без сайта (NO_WEBSITE_LISTED)"
                >
                  Без сайта ({searchResults.filter((c) => c.websiteStatus === 'NO_WEBSITE_LISTED').length})
                </button>
                <button
                  type="button"
                  className={`lang-btn ${filterWebsiteOnly === 'HAS_SITE' ? 'active' : ''}`}
                  onClick={() => setFilterWebsiteOnly('HAS_SITE')}
                >
                  С сайтом ({searchResults.filter((c) => c.websiteStatus === 'WEBSITE_LISTED').length})
                </button>
              </div>
            </div>

            {/* Batch actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="text-btn" onClick={handleSelectAllNew}>
                <CheckSquare size={13} />
                <span>Выбрать новые</span>
              </button>
              {selectedCompanyIds.size > 0 && (
                <>
                  <button type="button" className="text-btn" onClick={handleDeselectAll}>
                    <Square size={13} />
                    <span>Снять выбор</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleImportSelected}
                  >
                    <Plus size={13} />
                    <span>Импортировать выбранные ({selectedCompanyIds.size})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Results List */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {searchResults.length === 0 && !isLoading && !searchError && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <Search size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
              <div style={{ fontWeight: 600, color: '#334155' }}>
                Выберите источник ({sourceProvider}), город и категорию бизнеса, затем нажмите «Найти»
              </div>
              <div style={{ fontSize: '12.5px', marginTop: 4 }}>
                {sourceProvider === '2GIS'
                  ? 'Данные загружаются напрямую из официального каталога 2ГИС'
                  : 'Данные загружаются напрямую из OpenStreetMap через Overpass API'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayedCompanies.map((company) => {
              const inCrm = isAlreadyInCrm(company);
              const isSelected = selectedCompanyIds.has(company.id);

              return (
                <div
                  key={company.id}
                  style={{
                    background: inCrm ? '#f8fafc' : '#ffffff',
                    border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: isSelected ? '0 0 0 1px #3b82f6' : 'none',
                  }}
                >
                  {/* Checkbox and Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={inCrm}
                      onChange={() => toggleSelect(company.id)}
                      style={{ marginTop: 4, cursor: inCrm ? 'not-allowed' : 'pointer' }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                          {company.name}
                        </span>
                        <span className="tag-category">{company.category}</span>
                        <span className="tag-city">{company.city}</span>

                        {/* Source Tag */}
                        <span
                          style={{
                            fontSize: '11px',
                            background: company.source === 'OSM' ? '#eff6ff' : '#f0fdf4',
                            color: company.source === 'OSM' ? '#1d4ed8' : '#166534',
                            border: `1px solid ${company.source === 'OSM' ? '#bfdbfe' : '#bbf7d0'}`,
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {company.source === 'OSM' ? 'OSM' : '2GIS'}
                        </span>

                        {inCrm ? (
                          <span
                            style={{
                              fontSize: '11px',
                              background: '#f1f5f9',
                              color: '#64748b',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 600,
                            }}
                          >
                            ✓ Уже в CRM
                          </span>
                        ) : null}
                      </div>

                      {/* Address, Coordinates & Contacts */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          marginTop: 6,
                          fontSize: '12.5px',
                          color: '#475569',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={13} color="#64748b" />
                          <span>{company.address}</span>
                        </div>

                        {/* GPS Coordinates (from OSM) */}
                        {company.coordinates && (
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            📍 {company.coordinates.lat.toFixed(4)}, {company.coordinates.lon.toFixed(4)}
                          </span>
                        )}

                        {/* Phone */}
                        {company.isValidPhone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={13} color="#0284c7" />
                            <strong style={{ color: '#0369a1' }}>
                              {formatPhoneForDisplay(company.phoneFormatted)}
                            </strong>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>
                            {company.phoneRaw ? company.phoneRaw : 'Телефон не указан'}
                          </span>
                        )}

                        {/* Website Status Badge (Requirement 4: NO_WEBSITE_LISTED) */}
                        {company.websiteStatus === 'WEBSITE_LISTED' && company.websiteUrl ? (
                          <a
                            href={company.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: '11px',
                              background: '#ecfdf5',
                              color: '#065f46',
                              padding: '2px 6px',
                              borderRadius: 4,
                              textDecoration: 'none',
                              border: '1px solid #a7f3d0',
                            }}
                            title="Сайт указан в доступных источниках"
                          >
                            <Globe size={11} />
                            <span>{company.websiteUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              background: '#eff6ff',
                              color: '#1e40af',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 500,
                              border: '1px solid #bfdbfe',
                            }}
                            title="Сайт не указан в источнике данных"
                          >
                            NO_WEBSITE_LISTED
                          </span>
                        )}

                        {/* External Object Link */}
                        {company.externalUrl && (
                          <a
                            href={company.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: '11px',
                              color: '#0284c7',
                              textDecoration: 'none',
                            }}
                            title={
                              company.source === 'OSM'
                                ? 'Открыть объект на карте OpenStreetMap'
                                : 'Открыть карточку в 2ГИС'
                            }
                          >
                            <span>{company.source === 'OSM' ? 'Объект OSM' : 'Карточка 2ГИС'}</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {inCrm ? (
                      <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> В базе
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleImportSingle(company)}
                        title="Добавить в CRM и подготовить WhatsApp Click-to-Chat"
                      >
                        <Plus size={13} />
                        <span>В CRM</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Все организации из 2GIS и OpenStreetMap подключаются к WhatsApp Click-to-Chat.
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
