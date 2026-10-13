import React, { useState } from 'react';
import { X, ExternalLink, Check, Copy } from 'lucide-react';
import { generateWhatsAppLink, normalizePhoneNumber, getDefaultMessage, openWhatsAppSafely } from '../utils/whatsapp';

interface UrlValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const UrlValidatorModal: React.FC<UrlValidatorModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [testPhone, setTestPhone] = useState('+7 777 456-80-00');
  const [language, setLanguage] = useState<'ru' | 'kz'>('ru');
  const [testText, setTestText] = useState(
    getDefaultMessage('Aura Beauty Studio', 'Студия красоты', 'ru')
  );

  if (!isOpen) return null;

  const phoneRes = normalizePhoneNumber(testPhone);

  let generatedUrl = '';
  let decodedText = '';
  let urlError = '';

  if (phoneRes.isValid) {
    try {
      generatedUrl = generateWhatsAppLink(phoneRes.normalized, testText);
      const parsed = new URL(generatedUrl);
      decodedText = parsed.searchParams.get('text') || '';
    } catch (e: any) {
      urlError = e.message || 'Ошибка генерации';
    }
  }

  const isExactMatch = decodedText === testText;

  const handleApplyPreset = (lang: 'ru' | 'kz') => {
    setLanguage(lang);
    if (lang === 'ru') {
      setTestPhone('+7 777 456-80-00');
      setTestText(getDefaultMessage('Aura Beauty', 'Студия красоты', 'ru'));
    } else {
      setTestPhone('8 (701) 987-65-43');
      setTestText(getDefaultMessage('Сұлулық әлемі', 'Сұлулық салоны', 'kz'));
    }
  };

  const handleCopyUrl = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      onShowToast('Ссылка скопирована в буфер обмена! 📋', 'success');
    } catch {
      onShowToast('Ошибка копирования', 'error');
    }
  };

  const handleTestOpen = () => {
    if (!generatedUrl) return;
    openWhatsAppSafely(generatedUrl);
    onShowToast('Тестовая ссылка открыта в новой вкладке WhatsApp', 'info');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Валидатор ссылок WhatsApp (RU / KZ)</h2>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Проверка корректности кодирования кириллицы, казахских символов, эмодзи и переносов строк
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            className={`btn btn-sm ${language === 'ru' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleApplyPreset('ru')}
          >
            🇷🇺 Тест на русском языке (RU)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${language === 'kz' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleApplyPreset('kz')}
          >
            🇰🇿 Қазақша тестілеу (KZ әіңғүұқөһ)
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Тестовый номер телефона</label>
          <input
            type="text"
            className="form-input"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />
          <div style={{ fontSize: '12px', marginTop: 4, color: phoneRes.isValid ? '#16a34a' : '#ef4444' }}>
            {phoneRes.isValid
              ? `Преобразован в E.164 (только цифры): ${phoneRes.normalized}`
              : phoneRes.error}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Исходный текст сообщения</label>
          <textarea
            className="form-textarea"
            rows={7}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />
        </div>

        {/* Generated URL */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="form-label" style={{ margin: 0 }}>
              Сгенерированная ссылка WhatsApp:
            </label>
            <button type="button" className="text-btn" onClick={handleCopyUrl} disabled={!generatedUrl}>
              <Copy size={13} />
              <span>Копировать URL</span>
            </button>
          </div>
          <div className="url-box" style={{ maxHeight: '90px', overflowY: 'auto' }}>
            {generatedUrl || <span style={{ color: '#ef4444' }}>{urlError}</span>}
          </div>
        </div>

        {/* Verification Check */}
        <div
          style={{
            background: isExactMatch ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${isExactMatch ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: '8px',
            padding: '12px',
            marginTop: '8px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: isExactMatch ? '#166534' : '#991b1b' }}>
            {isExactMatch ? <Check size={16} /> : <X size={16} />}
            <span>
              {isExactMatch
                ? 'Проверка пройдена: 100% точное декодирование символов без двойного кодирования!'
                : 'Несовпадение при декодировании'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: 4 }}>
            Кириллица, казахские буквы (ә, і, ң, ғ, ү, ұ, қ, ө, һ), эмодзи (👋) и переводы строк ({'%0A'}) корректно поддерживаются.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
          <button className="btn btn-whatsapp" onClick={handleTestOpen} disabled={!generatedUrl}>
            <ExternalLink size={16} />
            <span>Открыть ссылку в WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
