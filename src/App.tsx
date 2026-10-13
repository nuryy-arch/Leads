import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, AlertCircle } from 'lucide-react';
import type { BusinessLead, Language, LeadStatus } from './types';
import { INITIAL_LEADS } from './data/mockLeads';
import { Header } from './components/Header';
import { LeadCard } from './components/LeadCard';
import { LeadEditModal } from './components/LeadEditModal';
import { AddLeadModal } from './components/AddLeadModal';
import { HistoryModal } from './components/HistoryModal';
import { UrlValidatorModal } from './components/UrlValidatorModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
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

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [languageFilter, setLanguageFilter] = useState<Language | 'ALL'>('ALL');

  // Modal states
  const [activeEditLead, setActiveEditLead] = useState<BusinessLead | null>(null);
  const [activeHistoryLead, setActiveHistoryLead] = useState<BusinessLead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isValidatorModalOpen, setIsValidatorModalOpen] = useState(false);

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

  const handleResetDemo = () => {
    if (window.confirm('Сбросить базу контактов к демонстрационным исходным данным?')) {
      setLeads(INITIAL_LEADS);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      showToast('База успешно сброшена к исходным демо-данным', 'info');
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search matching
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchesName = lead.businessName.toLowerCase().includes(query);
        const matchesPhone = lead.phoneFormatted.includes(query) || lead.phoneRaw.includes(query);
        const matchesCategory = lead.category.toLowerCase().includes(query);
        const matchesCity = lead.city.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesCategory && !matchesCity) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) {
        return false;
      }

      // Language filter
      if (languageFilter !== 'ALL' && lead.language !== languageFilter) {
        return false;
      }

      return true;
    });
  }, [leads, searchQuery, statusFilter, languageFilter]);

  return (
    <div className="app-container">
      {/* Header and Statistics */}
      <Header
        leads={leads}
        activeStatusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenValidatorModal={() => setIsValidatorModalOpen(true)}
        onResetDemo={handleResetDemo}
      />

      {/* Search & Filters Control Bar */}
      <div className="controls-bar">
        <div className="search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Поиск по названию бизнеса, телефону, категории или городу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Статус:
          </label>
          <select
            className="select-custom"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Все статусы ({leads.length})</option>
            <option value="NEW">Новые</option>
            <option value="LINK_OPENED">Ссылка открыта</option>
            <option value="SENT">Отправлено вручную</option>
            <option value="INTERESTED">Заинтересованы 🔥</option>
            <option value="REJECTED">Отказ</option>
            <option value="DO_NOT_CONTACT">Не беспокоить (DNC)</option>
          </select>

          <label style={{ fontSize: '13px', color: '#64748b', marginLeft: 8 }}>Язык:</label>
          <select
            className="select-custom"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value as any)}
          >
            <option value="ALL">Любой язык</option>
            <option value="ru">Русский (RU)</option>
            <option value="kz">Қазақша (KZ)</option>
          </select>
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
            Попробуйте сбросить поисковый запрос или фильтры статуса.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setLanguageFilter('ALL');
            }}
          >
            Сбросить фильтры
          </button>
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
