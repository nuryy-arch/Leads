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
} from 'lucide-react';
import type { BusinessLead, DiscoveredCompany, KazakhstanCity } from '../types';
import { KAZAKHSTAN_CITIES, BUSINESS_CATEGORIES } from '../data/kazakhstanData';
import {
  searchTwoGisCompanies,
  getStoredTwoGisApiKey,
} from '../services/twoGisService';
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
  const [selectedCity, setSelectedCity] = useState<KazakhstanCity>(KAZAKHSTAN_CITIES[0]);
  const [selectedCategory, setSelectedCategory] = useState(BUSINESS_CATEGORIES[0].query);
  const [customQuery, setCustomQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<DiscoveredCompany[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [totalFound, setTotalFound] = useState<number | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [filterWebsiteOnly, setFilterWebsiteOnly] = useState<'ALL' | 'NO_SITE' | 'HAS_SITE'>('ALL');

  if (!isOpen) return null;

  const apiKey = getStoredTwoGisApiKey();

  const handleSearch = async () => {
    if (!apiKey) {
      onShowToast('Необходимо настроить 2GIS API-ключ перед поиском', 'error');
      onOpenKeyModal();
      return;
    }

    const queryToUse = customQuery.trim() || selectedCategory;
    setIsLoading(true);
    setSearchError(null);
    setSelectedCompanyIds(new Set());

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
        if (result.companies.length === 0) {
          onShowToast('Организации по запросу не найдены', 'info');
        } else {
          onShowToast(`Найдено ${result.companies.length} организаций в 2ГИС`, 'success');
        }
      }
    } catch (e: any) {
      setSearchError(e.message || 'Ошибка выполнения поиска');
      onShowToast('Сетевая ошибка при поиске', 'error');
    } finally {
      setIsLoading(false);
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
    onShowToast(`«${company.name}» добавлена в CRM!`, 'success');
  };

  // Batch Import
  const handleImportSelected = () => {
    const selectedCompanies = searchResults.filter((c) => selectedCompanyIds.has(c.id));
    if (selectedCompanies.length === 0) {
      onShowToast('Выберите организации для импорта', 'info');
      return;
    }

    // Filter duplicates
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
        style={{ maxWidth: '980px', width: '95vw', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={22} color="#0284c7" />
              <span>Поиск потенциальных клиентов по Казахстану (2GIS API)</span>
            </h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
              Поиск реальных организаций, проверка наличия сайта и подключение к WhatsApp Click-to-Chat
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* API Key Status Notice */}
        {!apiKey ? (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#92400e' }}>
              <AlertCircle size={18} />
              <span>
                <strong>2GIS API-ключ не настроен.</strong> Для получения актуальных данных о компаниях требуется ключ API.
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
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#166534',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '6px 12px',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color="#16a34a" />
              <span>2GIS API подключен: используется официальный каталог организаций</span>
            </div>
            <button type="button" className="text-btn" onClick={onOpenKeyModal} style={{ fontSize: '11.5px' }}>
              Изменить ключ
            </button>
          </div>
        )}

        {/* Search Parameters Form */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
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
                placeholder="Например: детейлинг, спа"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSearch}
                disabled={isLoading}
                style={{ padding: '9px 18px' }}
              >
                <Search size={16} />
                <span>{isLoading ? 'Поиск...' : 'Найти'}</span>
              </button>
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
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                Найдено в 2ГИС: {searchResults.length}
                {totalFound && totalFound > searchResults.length ? ` (всего ${totalFound})` : ''}
              </span>

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
                  title="Компании без сайта в справочнике (целевая аудитория)"
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
                Выберите город Казахстана и категорию бизнеса, затем нажмите «Найти»
              </div>
              <div style={{ fontSize: '12.5px', marginTop: 4 }}>
                Данные загружаются напрямую из официального API 2ГИС
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

                      {/* Address & Contacts */}
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

                        {/* Website Status Badge (Requirement 4) */}
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
                            title="Сайт указан в карточке 2ГИС"
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
                            title="В доступных источниках сайт не указан"
                          >
                            NO_WEBSITE_LISTED
                          </span>
                        )}

                        {/* 2GIS Card Link */}
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
                            title="Открыть карточку организации в 2ГИС"
                          >
                            <span>Карточка 2ГИС</span>
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
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Все добавленные организации автоматически подключаются к WhatsApp Click-to-Chat.
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
