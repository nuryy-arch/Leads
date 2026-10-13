import React, { useState } from 'react';
import { X, Key, CheckCircle, AlertTriangle, ExternalLink, HelpCircle, Save } from 'lucide-react';
import {
  getStoredTwoGisApiKey,
  saveTwoGisApiKey,
  verifyTwoGisApiKey,
  type ApiKeyVerificationResult,
} from '../services/twoGisService';

interface TwoGisKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (apiKey: string) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const TwoGisKeyModal: React.FC<TwoGisKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
  onShowToast,
}) => {
  const [apiKey, setApiKey] = useState(getStoredTwoGisApiKey);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<ApiKeyVerificationResult | null>(null);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const result = await verifyTwoGisApiKey(apiKey);
      setVerificationResult(result);

      if (result.isValid) {
        onShowToast('API-ключ 2GIS успешно проверен и работает!', 'success');
      } else {
        onShowToast(`Ошибка проверки ключа: ${result.message}`, 'error');
      }
    } catch (e: any) {
      setVerificationResult({
        isValid: false,
        message: e.message || 'Сетевая ошибка при проверке',
      });
      onShowToast('Не удалось выполнить проверку', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    saveTwoGisApiKey(apiKey);
    onKeySaved(apiKey.trim());
    onShowToast('API-ключ сохранен!', 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={20} color="#0284c7" />
              <span>Настройка официального API 2GIS</span>
            </h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
              Для автоматического поиска реальных компаний по Казахстану
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* API Key Form */}
        <div className="form-group">
          <label className="form-label">
            Ключ API 2GIS (Places / Каталог API 3.0)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setVerificationResult(null);
              }}
              placeholder="Вставьте ваш API-ключ 2GIS (например: 7a8b9c...)"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleVerify}
              disabled={isVerifying || !apiKey.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isVerifying ? 'Проверка...' : 'Проверить ключ'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
            Ключ сохраняется локально в вашем браузере (LocalStorage) и не передается третьим лицам.
          </div>
        </div>

        {/* Verification Alert */}
        {verificationResult && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              background: verificationResult.isValid ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${verificationResult.isValid ? '#a7f3d0' : '#fecaca'}`,
              color: verificationResult.isValid ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {verificationResult.isValid ? (
              <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            ) : (
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            )}
            <div>
              <div style={{ fontWeight: 600 }}>
                {verificationResult.isValid ? 'Ключ валиден' : 'Ошибка проверки ключа'}
              </div>
              <div style={{ marginTop: 2, fontSize: '12px' }}>
                {verificationResult.message}
              </div>
            </div>
          </div>
        )}

        {/* Instructions Guide */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: '8px',
            }}
          >
            <HelpCircle size={16} color="#0284c7" />
            <span>Инструкция: Как получить официальный ключ 2GIS API</span>
          </div>

          <ol
            style={{
              paddingLeft: '20px',
              fontSize: '12.5px',
              color: '#475569',
              lineHeight: 1.65,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <li>
              Перейдите на портал разработчиков 2ГИС:{' '}
              <a
                href="https://dev.2gis.kz/"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#0284c7', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}
              >
                dev.2gis.kz <ExternalLink size={11} />
              </a>{' '}
              (или <a href="https://dev.2gis.ru/" target="_blank" rel="noreferrer" style={{ color: '#0284c7' }}>dev.2gis.ru</a>).
            </li>
            <li>Зарегистрируйтесь или войдите в личный кабинет 2GIS.</li>
            <li>
              Перейдите в раздел <strong>«Ключи API»</strong> и нажмите <strong>«Создать ключ»</strong>.
            </li>
            <li>
              Выберите продукт <strong>«Каталог API / Places API 3.0»</strong> (поиск организаций, контактов и адресов).
            </li>
            <li>Скопируйте полученный ключ, вставьте в поле выше и нажмите <strong>«Проверить ключ»</strong>.</li>
          </ol>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={15} />
            <span>Сохранить настройки</span>
          </button>
        </div>
      </div>
    </div>
  );
};
