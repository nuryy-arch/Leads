import React, { useState } from 'react';
import { X, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BusinessLead, Language } from '../types';
import { normalizePhoneNumber, formatPhoneForDisplay, createHistoryEvent } from '../utils/whatsapp';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newLead: BusinessLead) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  onShowToast,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Студия красоты');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [city, setCity] = useState('Алматы');
  const [language, setLanguage] = useState<Language>('ru');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const phoneValidation = normalizePhoneNumber(phoneRaw);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      onShowToast('Введите название бизнеса', 'error');
      return;
    }

    if (!phoneValidation.isValid) {
      onShowToast(phoneValidation.error || 'Проверьте формат номера телефона', 'error');
      return;
    }

    const now = new Date().toISOString();
    const newLead: BusinessLead = {
      id: `lead-${Date.now()}`,
      businessName: businessName.trim(),
      category: category.trim(),
      phoneRaw: phoneRaw.trim(),
      phoneFormatted: phoneValidation.normalized,
      isValidPhone: true,
      city: city.trim(),
      websiteStatus: 'NO_WEBSITE_LISTED',
      source: 'MANUAL',
      language,
      status: 'NEW',
      notes: notes.trim(),
      history: [
        createHistoryEvent(
          'STATUS_CHANGED',
          `Бизнес успешно добавлен в базу контактов. Форматированный номер: ${phoneValidation.normalized}`,
          undefined,
          'NEW'
        ),
      ],
      createdAt: now,
      updatedAt: now,
    };

    onAdd(newLead);
    onShowToast(`Бизнес «${newLead.businessName}» успешно добавлен!`, 'success');
    onClose();

    // Reset form
    setBusinessName('');
    setPhoneRaw('');
    setNotes('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Добавить нового клиента / бизнес</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Название бизнеса *</label>
            <input
              type="text"
              className="form-input"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Например: Салон красоты «Mon Amie»"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Сфера деятельности / категория</label>
              <input
                type="text"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Студия красоты, Барбершоп..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Город</label>
              <input
                type="text"
                className="form-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Алматы, Астана, Шымкент..."
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Публичный номер WhatsApp *</label>
            <input
              type="text"
              className="form-input"
              value={phoneRaw}
              onChange={(e) => setPhoneRaw(e.target.value)}
              placeholder="+7 777 456-80-00 или 87019876543"
              required
            />

            {phoneRaw && (
              <div style={{ marginTop: 6, fontSize: '12px' }}>
                {phoneValidation.isValid ? (
                  <div style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={14} />
                    <span>
                      Формат корректен: <strong>{phoneValidation.normalized}</strong> (
                      {formatPhoneForDisplay(phoneValidation.normalized)})
                    </span>
                  </div>
                ) : (
                  <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertCircle size={14} />
                    <span>{phoneValidation.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Язык обращения по умолчанию</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="lang"
                  checked={language === 'ru'}
                  onChange={() => setLanguage('ru')}
                />
                🇷🇺 Русский
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="radio"
                  name="lang"
                  checked={language === 'kz'}
                  onChange={() => setLanguage('kz')}
                />
                🇰🇿 Қазақша
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Заметки (необязательно)</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Активны в Instagram, нужен сайт с онлайн-записью"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={!phoneValidation.isValid}>
              <Plus size={16} />
              <span>Добавить в базу</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
