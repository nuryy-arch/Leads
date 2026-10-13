import React from 'react';
import { MessageSquare, Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { BusinessLead, LeadStatus } from '../types';

interface HeaderProps {
  leads: BusinessLead[];
  activeStatusFilter: LeadStatus | 'ALL';
  onFilterChange: (status: LeadStatus | 'ALL') => void;
  onOpenAddModal: () => void;
  onOpenValidatorModal: () => void;
  onResetDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  leads,
  activeStatusFilter,
  onFilterChange,
  onOpenAddModal,
  onOpenValidatorModal,
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
            WhatsApp Click-to-Chat Outbound Module
          </h1>
          <p className="header-subtitle">
            Персонализированная отправка коммерческих предложений по разработке сайтов с безопасной генерацией ссылок и защитой от спама.
          </p>
          <div className="badge-author">
            <Sparkles size={14} color="#16a34a" />
            <span>Разработчик: Нурдаулет • Продажи сайтов для бизнеса</span>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            <span>Добавить бизнес</span>
          </button>
          <button className="btn btn-secondary" onClick={onOpenValidatorModal} title="Тестирование формирования ссылок на казахском и русском">
            <span>Проверка ссылок (RU / KZ)</span>
          </button>
          <button className="btn btn-secondary" onClick={onResetDemo} title="Сбросить базу до исходных демо-данных">
            <RefreshCw size={14} />
            <span>Сброс базы</span>
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
