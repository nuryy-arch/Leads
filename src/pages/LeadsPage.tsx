import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Building2, Plus, Download } from 'lucide-react';
import type { BusinessLead, Language, LeadStatus, WebsiteStatus } from '../types';
import { KAZAKHSTAN_CITIES, BUSINESS_CATEGORIES } from '../data/kazakhstanData';
import { Header } from '../components/Header';
import { LeadCard } from '../components/LeadCard';
import { LeadEditModal } from '../components/LeadEditModal';
import { AddLeadModal } from '../components/AddLeadModal';
import { HistoryModal } from '../components/HistoryModal';
import { UrlValidatorModal } from '../components/UrlValidatorModal';
import { ImportModal } from '../components/ImportModal';
import { exportLeadsToCsv } from '../utils/leadManagement';
import { calculateLeadScore } from '../utils/scoring';

interface LeadsPageProps {
  leads: BusinessLead[];
  onUpdateLead: (updated: BusinessLead) => void;
  onAddLead: (newLead: BusinessLead) => void;
  onImportLeads: (newLeads: BusinessLead[]) => void;
  onResetDemo: () => void;
  is2GisKeySet: boolean;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({
  leads,
  onUpdateLead,
  onAddLead,
  onImportLeads,
  onResetDemo,
  is2GisKeySet,
  onShowToast,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filters initialized from URL search params if present
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>(
    (searchParams.get('status') as any) || 'ALL'
  );
  const [cityFilter, setCityFilter] = useState<string>(searchParams.get('city') || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'ALL');
  const [phoneFilter, setPhoneFilter] = useState<'ALL' | 'HAS_PHONE' | 'NO_PHONE'>('ALL');
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteStatus | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<Language | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'SCORE_DESC' | 'DATE_DESC' | 'NAME_ASC' | 'SCORE_ASC'>('SCORE_DESC');

  // Modal states
  const [activeEditLead, setActiveEditLead] = useState<BusinessLead | null>(null);
  const [activeHistoryLead, setActiveHistoryLead] = useState<BusinessLead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isValidatorModalOpen, setIsValidatorModalOpen] = useState(false);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (cityFilter !== 'ALL') params.set('city', cityFilter);
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, cityFilter, categoryFilter, setSearchParams]);

  // Unique lists for filter options
  const uniqueCities = useMemo(() => {
    const fromLeads = leads.map((l) => l.city);
    const fromKz = KAZAKHSTAN_CITIES.map((c) => c.name);
    return Array.from(new Set([...fromLeads, ...fromKz])).filter(Boolean).sort();
  }, [leads]);

  const uniqueCategories = useMemo(() => {
    const fromLeads = leads.map((l) => l.category);
    const fromKz = BUSINESS_CATEGORIES.map((c) => c.name);
    return Array.from(new Set([...fromLeads, ...fromKz])).filter(Boolean).sort();
  }, [leads]);

  // Filtered & Sorted Leads
  const filteredLeads = useMemo(() => {
    const filtered = leads.filter((lead) => {
      // Search matching (name, phone, category, address, city)
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchesName = lead.businessName.toLowerCase().includes(query);
        const matchesPhone = lead.phoneFormatted.includes(query) || lead.phoneRaw.includes(query);
        const matchesCategory = lead.category.toLowerCase().includes(query);
        const matchesCity = lead.city.toLowerCase().includes(query);
        const matchesAddress = lead.address?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesPhone && !matchesCategory && !matchesCity && !matchesAddress) {
          return false;
        }
      }

      // CRM Status filter
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) {
        return false;
      }

      // City filter
      if (cityFilter !== 'ALL' && lead.city.toLowerCase() !== cityFilter.toLowerCase()) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && lead.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Phone filter
      if (phoneFilter === 'HAS_PHONE' && !lead.isValidPhone) {
        return false;
      }
      if (phoneFilter === 'NO_PHONE' && lead.isValidPhone) {
        return false;
      }

      // Website filter
      if (websiteFilter !== 'ALL' && lead.websiteStatus !== websiteFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter !== 'ALL' && lead.source !== sourceFilter) {
        return false;
      }

      // Language filter
      if (languageFilter !== 'ALL' && lead.language !== languageFilter) {
        return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'SCORE_DESC' || sortBy === 'SCORE_ASC') {
        const scoreA = (a.score || calculateLeadScore(a)).score;
        const scoreB = (b.score || calculateLeadScore(b)).score;
        return sortBy === 'SCORE_DESC' ? scoreB - scoreA : scoreA - scoreB;
      }
      if (sortBy === 'NAME_ASC') {
        return a.businessName.localeCompare(b.businessName, 'ru');
      }
      if (sortBy === 'DATE_DESC') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [
    leads,
    searchQuery,
    statusFilter,
    cityFilter,
    categoryFilter,
    phoneFilter,
    websiteFilter,
    sourceFilter,
    languageFilter,
    sortBy,
  ]);

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      onShowToast('Нет контактов для экспорта', 'error');
      return;
    }
    exportLeadsToCsv(filteredLeads);
    onShowToast(`Экспортировано ${filteredLeads.length} контактов в CSV! 📥`, 'success');
  };

  return (
    <div className="leads-page-container">
      {/* Header and Statistics */}
      <Header
        leads={leads}
        activeStatusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenValidatorModal={() => setIsValidatorModalOpen(true)}
        onOpenLeadFinderModal={() => navigate('/finder')}
        onOpenKeyModal={() => navigate('/settings')}
        onExportCsv={handleExportCsv}
        is2GisKeySet={is2GisKeySet}
        onResetDemo={onResetDemo}
      />

      {/* Search & Filters Control Bar */}
      <div className="controls-bar" style={{ gap: 12 }}>
        {/* Search Input */}
        <div className="search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Поиск по названию, телефону, категории, городу или адресу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => setSearchQuery('')}
              title="Очистить поиск"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="filters-group">
          {/* City filter */}
          <select
            className="select-custom"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            title="Фильтр по городу Казахстана"
          >
            <option value="ALL">Все города ({uniqueCities.length})</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            className="select-custom"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            title="Фильтр по категории бизнеса"
          >
            <option value="ALL">Все сферы ({uniqueCategories.length})</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Phone filter */}
          <select
            className="select-custom"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value as any)}
            title="Фильтр по наличию номера"
          >
            <option value="ALL">Любой номер</option>
            <option value="HAS_PHONE">С валидным телефоном</option>
            <option value="NO_PHONE">Без телефона</option>
          </select>

          {/* Website status filter */}
          <select
            className="select-custom"
            value={websiteFilter}
            onChange={(e) => setWebsiteFilter(e.target.value as any)}
            title="Фильтр по сайту компании"
          >
            <option value="ALL">Любой статус сайта</option>
            <option value="NO_WEBSITE_LISTED">Сайт не указан (NO_WEBSITE_LISTED)</option>
            <option value="WEBSITE_LISTED">Сайт указан</option>
          </select>

          {/* Status filter */}
          <select
            className="select-custom"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            title="Статус в CRM"
          >
            <option value="ALL">Все статусы CRM ({leads.length})</option>
            <option value="NEW">Новые</option>
            <option value="LINK_OPENED">Ссылка открыта</option>
            <option value="SENT">Отправлено вручную</option>
            <option value="INTERESTED">Заинтересованы 🔥</option>
            <option value="REJECTED">Отказ</option>
            <option value="DO_NOT_CONTACT">Не беспокоить (DNC)</option>
          </select>

          {/* Source filter */}
          <select
            className="select-custom"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            title="Источник данных"
          >
            <option value="ALL">Любой источник</option>
            <option value="MULTI">Объединенные (Multi-source) ✨</option>
            <option value="2GIS">2GIS</option>
            <option value="OSM">OpenStreetMap (OSM)</option>
            <option value="FOURSQUARE">Foursquare Places</option>
            <option value="GOOGLE">Google Places</option>
            <option value="CSV">Импорт CSV/XLSX</option>
            <option value="DEMO">Демо-база</option>
            <option value="MANUAL">Вручную добавлен</option>
          </select>

          {/* Language filter */}
          <select
            className="select-custom"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value as any)}
            title="Язык обращения"
          >
            <option value="ALL">Любой язык</option>
            <option value="ru">Русский (RU)</option>
            <option value="kz">Қазақша (KZ)</option>
          </select>

          {/* Sort order selector */}
          <select
            className="select-custom"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            title="Сортировка списка лидов"
            style={{ fontWeight: 600, borderColor: '#cbd5e1' }}
          >
            <option value="SCORE_DESC">🔥 По рейтингу (сначала высокий)</option>
            <option value="SCORE_ASC">❄️ По рейтингу (сначала низкий)</option>
            <option value="DATE_DESC">🕒 По дате добавления (новые)</option>
            <option value="NAME_ASC">🔤 По названию (А-Я)</option>
          </select>

          {/* CSV Export Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            title="Экспорт текущей выборки в CSV с поддержкой Excel"
          >
            <Download size={15} />
            <span>Экспорт</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '0 4px',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Отображается: <strong>{filteredLeads.length}</strong> из <strong>{leads.length}</strong> контактов
          {searchQuery && <span> • Поиск: «{searchQuery}»</span>}
          {cityFilter !== 'ALL' && <span> • Город: {cityFilter}</span>}
          {categoryFilter !== 'ALL' && <span> • Сфера: {categoryFilter}</span>}
        </div>

        {(searchQuery ||
          statusFilter !== 'ALL' ||
          cityFilter !== 'ALL' ||
          categoryFilter !== 'ALL' ||
          phoneFilter !== 'ALL' ||
          websiteFilter !== 'ALL' ||
          sourceFilter !== 'ALL' ||
          languageFilter !== 'ALL') && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setCityFilter('ALL');
              setCategoryFilter('ALL');
              setPhoneFilter('ALL');
              setWebsiteFilter('ALL');
              setSourceFilter('ALL');
              setLanguageFilter('ALL');
            }}
          >
            Сбросить все фильтры
          </button>
        )}
      </div>

      {/* Leads Cards Grid */}
      {filteredLeads.length > 0 ? (
        <div className="leads-grid">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onUpdateLead={onUpdateLead}
              onOpenEditModal={(l) => setActiveEditLead(l)}
              onOpenHistoryModal={(l) => setActiveHistoryLead(l)}
              onShowToast={onShowToast}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <AlertCircle size={44} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h3>Ничего не найдено</h3>
          <p>Попробуйте изменить параметры фильтрации или строку поиска.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/finder')}>
              <Building2 size={15} />
              <span>Найти новые организации в 2GIS / OSM</span>
            </button>
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={15} />
              <span>Добавить контакт вручную</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <LeadEditModal
        lead={activeEditLead}
        onClose={() => setActiveEditLead(null)}
        onSave={onUpdateLead}
        onShowToast={onShowToast}
      />

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddLead}
        onShowToast={onShowToast}
      />

      <HistoryModal
        lead={activeHistoryLead}
        onClose={() => setActiveHistoryLead(null)}
      />

      <UrlValidatorModal
        isOpen={isValidatorModalOpen}
        onClose={() => setIsValidatorModalOpen(false)}
        onShowToast={onShowToast}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingLeads={leads}
        onImportLeads={onImportLeads}
        onShowToast={onShowToast}
      />
    </div>
  );
};
