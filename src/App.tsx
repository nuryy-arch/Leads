import React, { useState, useEffect, useMemo } from 'react';
import { Search, AlertCircle, Download, Building2 } from 'lucide-react';
import type { BusinessLead, Language, LeadStatus, WebsiteStatus } from './types';
import { INITIAL_LEADS } from './data/mockLeads';
import { KAZAKHSTAN_CITIES, BUSINESS_CATEGORIES } from './data/kazakhstanData';
import { Header } from './components/Header';
import { LeadCard } from './components/LeadCard';
import { LeadEditModal } from './components/LeadEditModal';
import { AddLeadModal } from './components/AddLeadModal';
import { HistoryModal } from './components/HistoryModal';
import { UrlValidatorModal } from './components/UrlValidatorModal';
import { LeadFinderModal } from './components/LeadFinderModal';
import { TwoGisKeyModal } from './components/TwoGisKeyModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { exportLeadsToCsv } from './utils/leadManagement';
import { getStoredTwoGisApiKey } from './services/twoGisService';
import './styles/app.css';

const LOCAL_STORAGE_KEY = 'whatsapp_click_to_chat_leads_v1';

export const App: React.FC = () => {
  // Leads state with localStorage persistence
  const [leads, setLeads] = useState<BusinessLead[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_LEADS;
  });

  // Filter & Search states (Requirement 6: filters by city, category, phone presence, website)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [phoneFilter, setPhoneFilter] = useState<'ALL' | 'HAS_PHONE' | 'NO_PHONE'>('ALL');
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteStatus | 'ALL'>('ALL');
  const [languageFilter, setLanguageFilter] = useState<Language | 'ALL'>('ALL');

  // Modal states
  const [activeEditLead, setActiveEditLead] = useState<BusinessLead | null>(null);
  const [activeHistoryLead, setActiveHistoryLead] = useState<BusinessLead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isValidatorModalOpen, setIsValidatorModalOpen] = useState(false);
  const [isLeadFinderOpen, setIsLeadFinderOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // 2GIS API Key active check
  const [apiKey, setApiKey] = useState(getStoredTwoGisApiKey);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [leads]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      text,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateLead = (updated: BusinessLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleAddLead = (newLead: BusinessLead) => {
    setLeads((prev) => [newLead, ...prev]);
  };

  // Batch import from 2GIS Lead Finder
  const handleImportLeads = (newLeads: BusinessLead[]) => {
    setLeads((prev) => [...newLeads, ...prev]);
  };

  const handleResetDemo = () => {
    if (window.confirm('Сбросить базу контактов к демонстрационным исходным данным?')) {
      setLeads(INITIAL_LEADS);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      showToast('База успешно сброшена к исходным демо-данным', 'info');
    }
  };

  // CSV Export (Requirement 6)
  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      showToast('Нет контактов для экспорта', 'error');
      return;
    }
    exportLeadsToCsv(filteredLeads);
    showToast(`Экспортировано ${filteredLeads.length} контактов в CSV! 📥`, 'success');
  };

  // Unique lists for dropdown filters
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

  // Filtered Leads (Requirement 6)
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
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

      // Phone presence filter
      if (phoneFilter === 'HAS_PHONE' && !lead.isValidPhone) {
        return false;
      }
      if (phoneFilter === 'NO_PHONE' && lead.isValidPhone) {
        return false;
      }

      // Website status filter
      if (websiteFilter !== 'ALL' && lead.websiteStatus !== websiteFilter) {
        return false;
      }

      // Language filter
      if (languageFilter !== 'ALL' && lead.language !== languageFilter) {
        return false;
      }

      return true;
    });
  }, [
    leads,
    searchQuery,
    statusFilter,
    cityFilter,
    categoryFilter,
    phoneFilter,
    websiteFilter,
    languageFilter,
  ]);

  return (
    <div className="app-container">
      {/* Header and Statistics */}
      <Header
        leads={leads}
        activeStatusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenValidatorModal={() => setIsValidatorModalOpen(true)}
        onOpenLeadFinderModal={() => setIsLeadFinderOpen(true)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onExportCsv={handleExportCsv}
        is2GisKeySet={Boolean(apiKey)}
        onResetDemo={handleResetDemo}
      />

      {/* Search & Filters Control Bar */}
      <div className="controls-bar" style={{ gap: 12 }}>
        {/* Search Input */}
        <div className="search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Поиск по названию бизнеса, телефону, адресу или категории..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters Group (Requirement 6: city, category, phone presence, website) */}
        <div className="filter-group">
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

          {/* Website status filter (Requirement 4 & 6) */}
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

          {/* CSV Export Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            style={{ padding: '8px 12px', fontSize: '13px' }}
            title="Экспорт отфильтрованных контактов в CSV"
          >
            <Download size={14} />
            <span>CSV ({filteredLeads.length})</span>
          </button>
        </div>
      </div>

      {/* Grid of Lead Cards */}
      {filteredLeads.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <AlertCircle size={32} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
          <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: 6 }}>
            Клиенты по заданным критериям не найдены
          </h3>
          <p style={{ fontSize: '14px', marginBottom: 16 }}>
            Попробуйте сбросить фильтры или найдите новые компании через 2GIS API.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setCityFilter('ALL');
                setCategoryFilter('ALL');
                setPhoneFilter('ALL');
                setWebsiteFilter('ALL');
                setLanguageFilter('ALL');
              }}
            >
              Сбросить фильтры
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setIsLeadFinderOpen(true)}
              style={{ backgroundColor: '#0284c7' }}
            >
              <Building2 size={16} />
              <span>Найти в 2ГИС</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="leads-grid">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onUpdateLead={handleUpdateLead}
              onOpenEditModal={(l) => setActiveEditLead(l)}
              onOpenHistoryModal={(l) => setActiveHistoryLead(l)}
              onShowToast={showToast}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <LeadFinderModal
        isOpen={isLeadFinderOpen}
        onClose={() => setIsLeadFinderOpen(false)}
        existingLeads={leads}
        onImportLeads={handleImportLeads}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onShowToast={showToast}
      />

      <TwoGisKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeySaved={(newKey) => {
          setApiKey(newKey);
          showToast('Ключ 2GIS сохранен', 'success');
        }}
        onShowToast={showToast}
      />

      <LeadEditModal
        lead={activeEditLead}
        onClose={() => setActiveEditLead(null)}
        onSave={handleUpdateLead}
        onShowToast={showToast}
      />

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddLead}
        onShowToast={showToast}
      />

      <HistoryModal
        lead={activeHistoryLead}
        onClose={() => setActiveHistoryLead(null)}
      />

      <UrlValidatorModal
        isOpen={isValidatorModalOpen}
        onClose={() => setIsValidatorModalOpen(false)}
        onShowToast={showToast}
      />

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;
