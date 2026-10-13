import React from 'react';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Building2,
  Key,
  Download,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { BusinessLead, LeadStatus } from '../types';

interface HeaderProps {
  leads: BusinessLead[];
  activeStatusFilter: LeadStatus | 'ALL';
  onFilterChange: (status: LeadStatus | 'ALL') => void;
  onOpenAddModal: () => void;
  onOpenValidatorModal: () => void;
  onOpenLeadFinderModal: () => void;
  onOpenKeyModal: () => void;
  onExportCsv: () => void;
  is2GisKeySet: boolean;
  onResetDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  leads,
  activeStatusFilter,
  onFilterChange,
  onOpenAddModal,
  onOpenValidatorModal,
  onOpenLeadFinderModal,
  onOpenKeyModal,
  onExportCsv,
  is2GisKeySet,
  onResetDemo,
}) => {
  const counts = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'NEW').length,
    opened: leads.filter((l) => l.status === 'LINK_OPENED').length,
    sent: leads.filter((l) => l.status === 'SENT').length,
    interested: leads.filter((l) => l.status === 'INTERESTED').length,
    rejected: leads.filter((l) => l.status === 'REJECTED').length,
    dnc: leads.filter((l) => l.status === 'DO_NOT_CONTACT').length,
  };

  return (
    <header className="header-card">
      <div className="header-top">
        <div className="header-title-block">
          <h1>
            <span style={{ color: '#25D366' }}>
              <MessageSquare size={30} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            </span>
            WhatsApp Click-to-Chat & Поиск клиентов по Казахстану
          </h1>
          <p className="header-subtitle">
            Автоматический поиск организаций по городам Казахстана через 2GIS API и безопасная отправка предложений сайтов через Click-to-Chat.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <div className="badge-author" style={{ marginTop: 0 }}>
              <Sparkles size={14} color="#16a34a" />
              <span>Разработчик: Нурдаулет • Продажи сайтов для бизнеса</span>
            </div>

            {/* 2GIS API Status Badge */}
            <button
              type="button"
              onClick={onOpenKeyModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: '12px',
                padding: '3px 10px',
                borderRadius: '9999px',
                cursor: 'pointer',
                border: '1px solid',
                background: is2GisKeySet ? '#f0fdf4' : '#fffbeb',
                borderColor: is2GisKeySet ? '#bbf7d0' : '#fde68a',
                color: is2GisKeySet ? '#166534' : '#92400e',
                fontWeight: 600,
              }}
              title="Нажмите для настройки API-ключа 2GIS"
            >
              {is2GisKeySet ? (
                <>
                  <ShieldCheck size={13} color="#16a34a" />
                  <span>2GIS API активен</span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} color="#d97706" />
                  <span>2GIS: Требуется ключ</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="header-actions">
          {/* Main New Lead Discovery Button */}
          <button
            className="btn btn-primary"
            onClick={onOpenLeadFinderModal}
            style={{ backgroundColor: '#0284c7' }}
            title="Автоматический поиск реальных компаний по Казахстану через 2GIS и OpenStreetMap"
          >
            <Building2 size={16} />
            <span>Найти клиентов (2GIS / OSM)</span>
          </button>

          <button className="btn btn-secondary" onClick={onOpenAddModal} title="Вручную добавить организацию">
            <Plus size={16} />
            <span>+ Добавить</span>
          </button>

          <button className="btn btn-secondary" onClick={onExportCsv} title="Экспорт контактов в Excel/CSV с поддержкой кириллицы">
            <Download size={15} />
            <span>Экспорт CSV</span>
          </button>

          <button className="btn btn-secondary" onClick={onOpenKeyModal} title="Настройки API 2GIS">
            <Key size={14} />
            <span>Ключ API</span>
          </button>

          <button className="btn btn-secondary" onClick={onOpenValidatorModal} title="Тестирование формирования ссылок на казахском и русском">
            <span>Тест ссылок (RU/KZ)</span>
          </button>

          <button className="btn btn-secondary" onClick={onResetDemo} title="Сбросить базу до исходных демо-данных">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div
          className={`stat-item ${activeStatusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => onFilterChange('ALL')}
        >
          <div className="stat-number" style={{ color: '#0f172a' }}>{counts.total}</div>
          <div className="stat-label">Всего бизнесов</div>
        </div>

        <div
          className={`stat-item ${activeStatusFilter === 'NEW' ? 'active' : ''}`}
          onClick={() => onFilterChange('NEW')}
        >
          <div className="stat-number" style={{ color: '#3b82f6' }}>{counts.new}</div>
          <div className="stat-label">Новые</div>
        </div>

        <div
          className={`stat-item ${activeStatusFilter === 'LINK_OPENED' ? 'active' : ''}`}
          onClick={() => onFilterChange('LINK_OPENED')}
        >
          <div className="stat-number" style={{ color: '#8b5cf6' }}>{counts.opened}</div>
          <div className="stat-label">Открыт WhatsApp</div>
        </div>

        <div
          className={`stat-item ${activeStatusFilter === 'SENT' ? 'active' : ''}`}
          onClick={() => onFilterChange('SENT')}
        >
          <div className="stat-number" style={{ color: '#10b981' }}>{counts.sent}</div>
          <div className="stat-label">Отправлено</div>
        </div>

        <div
          className={`stat-item ${activeStatusFilter === 'INTERESTED' ? 'active' : ''}`}
          onClick={() => onFilterChange('INTERESTED')}
        >
          <div className="stat-number" style={{ color: '#059669' }}>{counts.interested}</div>
          <div className="stat-label">Заинтересованы 🔥</div>
        </div>

        <div
          className={`stat-item ${activeStatusFilter === 'REJECTED' ? 'active' : ''}`}
          onClick={() => onFilterChange('REJECTED')}
        >
          <div className="stat-number" style={{ color: '#d97706' }}>{counts.rejected}</div>
          <div className="stat-label">Отказ</div>
        </div>

        <div
          className={`stat-item ${activeStatusFilter === 'DO_NOT_CONTACT' ? 'active' : ''}`}
          onClick={() => onFilterChange('DO_NOT_CONTACT')}
        >
          <div className="stat-number" style={{ color: '#ef4444' }}>{counts.dnc}</div>
          <div className="stat-label">Не беспокоить ⛔</div>
        </div>
      </div>
    </header>
  );
};
