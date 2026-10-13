import React, { useState } from 'react';
import {
  ExternalLink,
  Edit3,
  Copy,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  History,
  Phone,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import type { BusinessLead, Language, LeadStatus } from '../types';
import {
  formatPhoneForDisplay,
  generateWhatsAppLink,
  getDefaultMessage,
  openWhatsAppSafely,
  createHistoryEvent,
} from '../utils/whatsapp';

interface LeadCardProps {
  lead: BusinessLead;
  onUpdateLead: (updated: BusinessLead) => void;
  onOpenEditModal: (lead: BusinessLead) => void;
  onOpenHistoryModal: (lead: BusinessLead) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  onUpdateLead,
  onOpenEditModal,
  onOpenHistoryModal,
  onShowToast,
}) => {
  const [showUrlDetails, setShowUrlDetails] = useState(false);

  // Active message is either user's custom edit or default generated based on language
  const activeMessage =
    lead.customMessage || getDefaultMessage(lead.businessName, lead.category, lead.language);

  // Computed link
  let whatsappUrl = '';
  let urlError = '';
  if (lead.isValidPhone) {
    try {
      whatsappUrl = generateWhatsAppLink(lead.phoneFormatted, activeMessage);
    } catch (e: any) {
      urlError = e.message || 'Ошибка генерации ссылки';
    }
  }

  const isDNC = lead.status === 'DO_NOT_CONTACT';

  // 1. "Открыть WhatsApp"
  const handleOpenWhatsApp = () => {
    if (isDNC) {
      onShowToast(
        'Внимание: Контакт помечен статусом DO_NOT_CONTACT! Отправка заблокирована.',
        'error'
      );
      return;
    }

    if (!lead.isValidPhone || !whatsappUrl) {
      onShowToast('Невозможно открыть WhatsApp: некорректный номер телефона', 'error');
      return;
    }

    // Safe user transition in new tab
    openWhatsAppSafely(whatsappUrl);

    // Rule: "После нажатия «Открыть WhatsApp» не отмечай сообщение как отправленное: фиксируй только факт открытия ссылки."
    const prevStatus = lead.status;
    const newStatus: LeadStatus = prevStatus === 'NEW' ? 'LINK_OPENED' : prevStatus;

    const newHistoryEvent = createHistoryEvent(
      'LINK_OPENED',
      'Ссылка WhatsApp открыта в новой вкладке. Текст подготовлен для ручной проверки и отправки пользователем.',
      prevStatus,
      newStatus
    );

    const updated: BusinessLead = {
      ...lead,
      status: newStatus,
      history: [newHistoryEvent, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onUpdateLead(updated);
    onShowToast('Ссылка WhatsApp открыта в новой вкладке! Проверьте текст и отправьте вручную.', 'info');
  };

  // 2. "Скопировать сообщение"
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);

      const copyEvent = createHistoryEvent(
        'MESSAGE_COPIED',
        'Текст предложения скопирован в буфер обмена'
      );

      const updated: BusinessLead = {
        ...lead,
        history: [copyEvent, ...lead.history],
        updatedAt: new Date().toISOString(),
      };

      onUpdateLead(updated);
      onShowToast('Текст сообщения успешно скопирован в буфер обмена! 📋', 'success');
    } catch {
      onShowToast('Ошибка копирования текста в буфер обмена', 'error');
    }
  };

  // 3. "Отметить как отправленное"
  const handleMarkAsSent = () => {
    if (isDNC) {
      onShowToast('Нельзя отметить отправку для контакта DO_NOT_CONTACT', 'error');
      return;
    }

    const prevStatus = lead.status;
    const newHistoryEvent = createHistoryEvent(
      'MARKED_SENT',
      'Сообщение вручную подтверждено пользователем как отправленное в WhatsApp',
      prevStatus,
      'SENT'
    );

    const updated: BusinessLead = {
      ...lead,
      status: 'SENT',
      history: [newHistoryEvent, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onUpdateLead(updated);
    onShowToast('Статус обновлен: Отмечено как отправленное ✅', 'success');
  };

  // 4. "Заинтересован"
  const handleMarkInterested = () => {
    const prevStatus = lead.status;
    const newHistoryEvent = createHistoryEvent(
      'STATUS_CHANGED',
      'Клиент проявил интерес к разработке сайта! Переговоры в процессе.',
      prevStatus,
      'INTERESTED'
    );

    const updated: BusinessLead = {
      ...lead,
      status: 'INTERESTED',
      history: [newHistoryEvent, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onUpdateLead(updated);
    onShowToast('Статус: Клиент заинтересован 🔥', 'success');
  };

  // 5. "Отказался"
  const handleMarkRejected = () => {
    const prevStatus = lead.status;
    const newHistoryEvent = createHistoryEvent(
      'STATUS_CHANGED',
      'Клиент отказался от предложения на данном этапе',
      prevStatus,
      'REJECTED'
    );

    const updated: BusinessLead = {
      ...lead,
      status: 'REJECTED',
      history: [newHistoryEvent, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onUpdateLead(updated);
    onShowToast('Статус: Клиент отказался', 'info');
  };

  // Switch language (RU / KZ)
  const handleLanguageChange = (newLang: Language) => {
    if (lead.language === newLang) return;
    const updated: BusinessLead = {
      ...lead,
      language: newLang,
      // If no custom edit was made, reset customMessage so default template updates cleanly
      customMessage: undefined,
      updatedAt: new Date().toISOString(),
    };
    onUpdateLead(updated);
    onShowToast(`Язык шаблона переключен на ${newLang === 'ru' ? 'русский' : 'казахский'}`, 'info');
  };

  // Toggle DO_NOT_CONTACT
  const handleToggleDNC = () => {
    const prevStatus = lead.status;
    const nextStatus: LeadStatus = prevStatus === 'DO_NOT_CONTACT' ? 'NEW' : 'DO_NOT_CONTACT';

    const event = createHistoryEvent(
      'STATUS_CHANGED',
      nextStatus === 'DO_NOT_CONTACT'
        ? 'Установлен статус DO_NOT_CONTACT: отправка заблокирована'
        : 'Снята блокировка DO_NOT_CONTACT: возвращен статус NEW',
      prevStatus,
      nextStatus
    );

    const updated: BusinessLead = {
      ...lead,
      status: nextStatus,
      history: [event, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onUpdateLead(updated);
    onShowToast(
      nextStatus === 'DO_NOT_CONTACT'
        ? 'Контакт добавлен в черный список (DO_NOT_CONTACT) ⛔'
        : 'Блокировка контакта снята',
      nextStatus === 'DO_NOT_CONTACT' ? 'error' : 'success'
    );
  };

  const getStatusBadge = () => {
    switch (lead.status) {
      case 'NEW':
        return <span className="status-badge NEW">Новый</span>;
      case 'LINK_OPENED':
        return <span className="status-badge LINK_OPENED">Ссылка открыта</span>;
      case 'SENT':
        return <span className="status-badge SENT">Отправлено</span>;
      case 'INTERESTED':
        return <span className="status-badge INTERESTED">Заинтересован 🔥</span>;
      case 'REJECTED':
        return <span className="status-badge REJECTED">Отказ</span>;
      case 'DO_NOT_CONTACT':
        return <span className="status-badge DO_NOT_CONTACT">⛔ DO NOT CONTACT</span>;
      default:
        return null;
    }
  };

  return (
    <div className={`lead-card status-${lead.status.toLowerCase().replace(/_/g, '-')}`}>
      {/* Card Header */}
      <div className="card-header">
        <div>
          <h2 className="business-name">{lead.businessName}</h2>
          <div className="business-meta">
            <span className="tag-category">{lead.category}</span>
            <span className="tag-city">{lead.city}</span>
            {lead.source === '2GIS' && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#f0fdf4',
                  color: '#166534',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 600,
                  border: '1px solid #bbf7d0',
                }}
              >
                2GIS
              </span>
            )}
            {lead.source === 'OSM' && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 600,
                  border: '1px solid #bfdbfe',
                }}
                title="Источник: OpenStreetMap (Overpass API)"
              >
                🗺️ OpenStreetMap
              </span>
            )}
            {lead.coordinates && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#f8fafc',
                  color: '#475569',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                }}
                title={`Координаты: ${lead.coordinates.lat.toFixed(5)}, ${lead.coordinates.lon.toFixed(5)}`}
              >
                📍 {lead.coordinates.lat.toFixed(4)}, {lead.coordinates.lon.toFixed(4)}
              </span>
            )}
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Address & Public Website info if available */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          fontSize: '12px',
          color: '#475569',
          flexWrap: 'wrap',
        }}
      >
        {lead.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#64748b' }}>📍</span>
            <span>{lead.address}</span>
          </div>
        )}

        {/* Website status (Requirement 4: NO_WEBSITE_LISTED) */}
        {lead.websiteStatus === 'WEBSITE_LISTED' && lead.websiteUrl ? (
          <a
            href={lead.websiteUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: '11px',
              background: '#ecfdf5',
              color: '#065f46',
              padding: '1px 6px',
              borderRadius: 4,
              textDecoration: 'none',
              border: '1px solid #a7f3d0',
            }}
            title="Сайт указан в карточке"
          >
            <span>🌐 {lead.websiteUrl.replace(/^https?:\/\//, '')}</span>
            <ExternalLink size={10} />
          </a>
        ) : (
          <span
            style={{
              fontSize: '11px',
              background: '#eff6ff',
              color: '#1e40af',
              padding: '1px 6px',
              borderRadius: 4,
              fontWeight: 500,
              border: '1px solid #bfdbfe',
            }}
            title="В доступных источниках сайт не указан"
          >
            NO_WEBSITE_LISTED
          </span>
        )}

        {lead.externalUrl && (
          <a
            href={lead.externalUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: '11px',
              color: '#0284c7',
              textDecoration: 'none',
              marginLeft: 'auto',
            }}
            title={lead.source === 'OSM' ? 'Открыть объект на карте OpenStreetMap' : 'Открыть карточку организации в 2ГИС'}
          >
            <span>{lead.source === 'OSM' ? 'Объект OSM' : 'Карточка 2ГИС'}</span>
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {lead.fetchedAt && (
        <div style={{ fontSize: '10.5px', color: '#94a3b8', marginBottom: 8, textAlign: 'right' }}>
          Получено: {new Date(lead.fetchedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} ({lead.source || 'Источник'})
        </div>
      )}

      {/* Phone Block */}
      <div className="phone-block">
        <div className="phone-row">
          <div className="phone-formatted">
            <Phone size={14} color="#0284c7" />
            <span>{formatPhoneForDisplay(lead.phoneFormatted)}</span>
          </div>
          <div className="lang-selector">
            <button
              type="button"
              className={`lang-btn ${lead.language === 'ru' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('ru')}
              title="Переключить шаблон на русский"
            >
              🇷🇺 RU
            </button>
            <button
              type="button"
              className={`lang-btn ${lead.language === 'kz' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('kz')}
              title="Переключить шаблон на казахский"
            >
              🇰🇿 KZ
            </button>
          </div>
        </div>

        <div className="phone-raw" style={{ marginTop: 4 }}>
          Ввод: <code style={{ fontSize: '11px', padding: '1px 4px' }}>{lead.phoneRaw}</code> →
          Международный формат: <code style={{ fontSize: '11px', padding: '1px 4px', fontWeight: 'bold' }}>{lead.phoneFormatted}</code>
        </div>

        {!lead.isValidPhone && (
          <div className="phone-error">
            <AlertTriangle size={13} />
            <span>{lead.phoneError || 'Некорректный формат номера'}</span>
          </div>
        )}
      </div>

      {/* Message Preview Box */}
      <div className="message-preview-container">
        <div className="message-preview-header">
          <span>Предпросмотр сообщения ({lead.language.toUpperCase()})</span>
          {lead.customMessage && (
            <span style={{ color: '#8b5cf6', fontSize: '11px' }}>✏️ Текст отредактирован</span>
          )}
        </div>
        <div className="message-preview-text">{activeMessage}</div>

        {/* Collapsible WhatsApp Link Details */}
        <div className="url-preview-details">
          <button
            type="button"
            className="text-btn"
            onClick={() => setShowUrlDetails(!showUrlDetails)}
          >
            {showUrlDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{showUrlDetails ? 'Скрыть ссылку WhatsApp' : 'Показать сгенерированную ссылку'}</span>
          </button>

          {showUrlDetails && (
            <div className="url-box">
              {whatsappUrl ? (
                <>
                  <div>{whatsappUrl}</div>
                  <div style={{ marginTop: 4, color: '#64748b' }}>
                    Формат: <code style={{ fontSize: '10px' }}>https://api.whatsapp.com/send/?phone=7...&text=...</code>
                  </div>
                </>
              ) : (
                <span style={{ color: '#ef4444' }}>{urlError || 'Ссылка не сформирована'}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Action Buttons (All 6 required by specification) */}
      <div className="card-actions-primary">
        {/* 1. Открыть WhatsApp */}
        <button
          type="button"
          className="btn btn-whatsapp"
          onClick={handleOpenWhatsApp}
          disabled={isDNC || !lead.isValidPhone}
          title={
            isDNC
              ? 'Контакт заблокирован (DO_NOT_CONTACT)'
              : 'Открыть WhatsApp Click-to-Chat в новой вкладке (не отправляет автоматически)'
          }
        >
          <ExternalLink size={16} />
          <span>Открыть WhatsApp</span>
        </button>

        {/* Row 2: Редактировать & Скопировать */}
        <div className="btn-action-row">
          {/* 2. Редактировать сообщение */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenEditModal(lead)}
            title="Редактировать текст сообщения перед отправкой"
          >
            <Edit3 size={14} />
            <span>Редактировать</span>
          </button>

          {/* 3. Скопировать сообщение */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyMessage}
            title="Скопировать готовый текст сообщения"
          >
            <Copy size={14} />
            <span>Скопировать</span>
          </button>
        </div>

        {/* Row 3: Отметить как отправленное & Статусы */}
        <div className="btn-status-group">
          {/* 4. Отметить как отправленное */}
          <button
            type="button"
            className="btn btn-sm btn-sent"
            onClick={handleMarkAsSent}
            disabled={isDNC}
            title="Вручную подтвердить, что сообщение отправлено в WhatsApp"
          >
            <CheckCircle size={13} />
            <span>Отправлено</span>
          </button>

          {/* 5. Заинтересован */}
          <button
            type="button"
            className="btn btn-sm btn-interested"
            onClick={handleMarkInterested}
            title="Клиент заинтересовался разработкой сайта"
          >
            <ThumbsUp size={13} />
            <span>Заинтересован</span>
          </button>

          {/* 6. Отказался */}
          <button
            type="button"
            className="btn btn-sm btn-rejected"
            onClick={handleMarkRejected}
            title="Клиент отказался"
          >
            <ThumbsDown size={13} />
            <span>Отказался</span>
          </button>
        </div>
      </div>

      {/* Footer Tools: DO_NOT_CONTACT Toggle and Audit History */}
      <div className="card-footer-tools">
        <button
          type="button"
          className="text-btn"
          onClick={() => onOpenHistoryModal(lead)}
          title="Посмотреть полную историю действий и изменений статуса"
        >
          <History size={13} />
          <span>История ({lead.history.length})</span>
        </button>

        <button
          type="button"
          className={`btn-sm ${isDNC ? 'btn-dnc' : 'text-btn'}`}
          onClick={handleToggleDNC}
          style={{ padding: '3px 8px', borderRadius: 4 }}
          title="Переключить статус DO_NOT_CONTACT"
        >
          <ShieldAlert size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
          <span>{isDNC ? 'В черном списке (DNC)' : 'Не беспокоить'}</span>
        </button>
      </div>
    </div>
  );
};
