import React, { useState } from 'react';
import { X, RotateCcw, ExternalLink, Save } from 'lucide-react';
import type { BusinessLead, Language } from '../types';
import {
  generateWhatsAppLink,
  getDefaultMessage,
  createHistoryEvent,
  openWhatsAppSafely,
} from '../utils/whatsapp';

interface LeadEditModalProps {
  lead: BusinessLead | null;
  onClose: () => void;
  onSave: (updated: BusinessLead) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const LeadEditModal: React.FC<LeadEditModalProps> = ({
  lead,
  onClose,
  onSave,
  onShowToast,
}) => {
  if (!lead) return null;

  const [message, setMessage] = useState(
    lead.customMessage || getDefaultMessage(lead.businessName, lead.category, lead.language)
  );
  const [lang, setLang] = useState<Language>(lead.language);

  const handleResetToDefault = () => {
    const defaultText = getDefaultMessage(lead.businessName, lead.category, lang);
    setMessage(defaultText);
    onShowToast('Текст сброшен к стандартному шаблону', 'info');
  };

  const handleLanguageSwitch = (newLang: Language) => {
    setLang(newLang);
    const defaultText = getDefaultMessage(lead.businessName, lead.category, newLang);
    setMessage(defaultText);
  };

  let generatedLink = '';
  try {
    generatedLink = generateWhatsAppLink(lead.phoneFormatted, message);
  } catch {}

  const handleSaveOnly = () => {
    const editEvent = createHistoryEvent(
      'MESSAGE_EDITED',
      'Текст персонального сообщения отредактирован пользователем'
    );

    const updated: BusinessLead = {
      ...lead,
      language: lang,
      customMessage: message,
      history: [editEvent, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
    onShowToast('Изменения сохранены!', 'success');
    onClose();
  };

  const handleSaveAndOpen = () => {
    if (lead.status === 'DO_NOT_CONTACT') {
      onShowToast('Контакт находится в статусе DO_NOT_CONTACT! Отправка заблокирована.', 'error');
      return;
    }

    if (!generatedLink) {
      onShowToast('Невозможно сформировать ссылку', 'error');
      return;
    }

    openWhatsAppSafely(generatedLink);

    const editEvent = createHistoryEvent(
      'MESSAGE_EDITED',
      'Текст персонального сообщения сохранен'
    );
    const openEvent = createHistoryEvent(
      'LINK_OPENED',
      'WhatsApp открыт с обновленным текстом в новой вкладке',
      lead.status,
      lead.status === 'NEW' ? 'LINK_OPENED' : lead.status
    );

    const updated: BusinessLead = {
      ...lead,
      language: lang,
      customMessage: message,
      status: lead.status === 'NEW' ? 'LINK_OPENED' : lead.status,
      history: [openEvent, editEvent, ...lead.history],
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
    onShowToast('WhatsApp открыт в новой вкладке!', 'info');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Редактирование сообщения</h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
              {lead.businessName} • {lead.phoneFormatted}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ margin: 0 }}>
              Язык шаблона
            </label>
            <div className="lang-selector">
              <button
                type="button"
                className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => handleLanguageSwitch('ru')}
              >
                Русский (RU)
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === 'kz' ? 'active' : ''}`}
                onClick={() => handleLanguageSwitch('kz')}
              >
                Қазақша (KZ)
              </button>
            </div>
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ margin: 0 }}>
              Текст коммерческого предложения
            </label>
            <button
              type="button"
              className="text-btn"
              onClick={handleResetToDefault}
              title="Вернуть исходный шаблон"
            >
              <RotateCcw size={12} />
              <span>Сбросить к шаблону</span>
            </button>
          </div>

          <textarea
            className="form-textarea"
            rows={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите текст сообщения..."
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: 4 }}>
            <span>Символов: {message.length}</span>
            <span>Поддерживаются кириллица, қазақ әріптері, эмодзи 👋 и ссылки</span>
          </div>
        </div>

        {/* Live URL Preview */}
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '12px' }}>
            Предпросмотр ссылки Click-to-Chat (автоматически кодируется без двойного экранирования):
          </label>
          <div className="url-box" style={{ maxHeight: '80px', overflowY: 'auto' }}>
            {generatedLink || 'Ошибка формирования ссылки'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-secondary" onClick={handleSaveOnly}>
            <Save size={15} />
            <span>Сохранить</span>
          </button>
          <button
            className="btn btn-whatsapp"
            onClick={handleSaveAndOpen}
            disabled={lead.status === 'DO_NOT_CONTACT'}
          >
            <ExternalLink size={15} />
            <span>Сохранить и Открыть WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
