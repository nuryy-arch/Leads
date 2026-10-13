import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Save,
  Trash2,
  Database,
  Download,
  RotateCcw,
  MessageSquare,
  Sparkles,
  Info,
  CheckCircle,
  MapPin,
  Globe,
} from 'lucide-react';
import type { BusinessLead } from '../types';
import {
  getStoredTwoGisApiKey,
  saveTwoGisApiKey,
  removeTwoGisApiKey,
  verifyTwoGisApiKey,
} from '../services/twoGisService';
import { foursquareProvider } from '../services/providers/foursquareProvider';
import { googlePlacesProvider } from '../services/providers/googlePlacesProvider';
import { getDefaultMessage } from '../utils/whatsapp';

interface SettingsPageProps {
  leads: BusinessLead[];
  onResetDemo: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  leads,
  onResetDemo,
  onShowToast,
}) => {
  // 2GIS state
  const [apiKeyInput, setApiKeyInput] = useState(getStoredTwoGisApiKey() || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Foursquare state
  const [fsqKeyInput, setFsqKeyInput] = useState(foursquareProvider.getApiKey() || '');
  const [isFsqSaved, setIsFsqSaved] = useState(foursquareProvider.isConfigured());

  // Google Places state
  const [googleKeyInput, setGoogleKeyInput] = useState(googlePlacesProvider.getApiKey() || '');
  const [isGoogleSaved, setIsGoogleSaved] = useState(googlePlacesProvider.isConfigured());

  const isKeySaved = Boolean(getStoredTwoGisApiKey());

  const handleSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      onShowToast('Введите API-ключ 2GIS', 'error');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    const testResult = await verifyTwoGisApiKey(trimmed);
    setIsVerifying(false);

    if (testResult.isValid) {
      saveTwoGisApiKey(trimmed);
      setVerificationResult({
        success: true,
        message: 'Ключ успешно проверен и сохранен в локальном хранилище!',
      });
      onShowToast('API-ключ 2GIS успешно сохранен!', 'success');
    } else {
      setVerificationResult({
        success: false,
        message: `Ошибка проверки: ${testResult.message || 'Ключ не принят сервером 2GIS'}. Ключ сохранен локально.`,
      });
      saveTwoGisApiKey(trimmed);
      onShowToast('Ключ 2GIS сохранен локально', 'info');
    }
  };

  const handleRemoveKey = () => {
    if (window.confirm('Удалить сохраненный API-ключ 2GIS?')) {
      removeTwoGisApiKey();
      setApiKeyInput('');
      setVerificationResult(null);
      onShowToast('Ключ 2GIS удален', 'info');
    }
  };

  const handleSaveFsqKey = () => {
    const trimmed = fsqKeyInput.trim();
    if (!trimmed) {
      onShowToast('Введите API-ключ Foursquare', 'error');
      return;
    }
    foursquareProvider.saveApiKey(trimmed);
    setIsFsqSaved(true);
    onShowToast('Ключ Foursquare Places сохранен!', 'success');
  };

  const handleRemoveFsqKey = () => {
    if (window.confirm('Удалить ключ Foursquare Places?')) {
      foursquareProvider.removeApiKey();
      setFsqKeyInput('');
      setIsFsqSaved(false);
      onShowToast('Ключ Foursquare удален', 'info');
    }
  };

  const handleSaveGoogleKey = () => {
    const trimmed = googleKeyInput.trim();
    if (!trimmed) {
      onShowToast('Введите API-ключ Google Places', 'error');
      return;
    }
    googlePlacesProvider.saveApiKey(trimmed);
    setIsGoogleSaved(true);
    onShowToast('Ключ Google Places сохранен!', 'success');
  };

  const handleRemoveGoogleKey = () => {
    if (window.confirm('Удалить ключ Google Places?')) {
      googlePlacesProvider.removeApiKey();
      setGoogleKeyInput('');
      setIsGoogleSaved(false);
      onShowToast('Ключ Google Places удален', 'info');
    }
  };

  const handleExportBackupJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(leads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `lead_hunter_kz_backup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onShowToast(`Резервная копия (${leads.length} лидов) скачана в JSON!`, 'success');
  };

  const storageUsageKb = (
    (localStorage.getItem('lead_hunter_kz_leads_v1')?.length || 0) / 1024
  ).toFixed(1);

  return (
    <div className="settings-page-container">
      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-title">Центр настроек и интеграций</h1>
        <p className="settings-subtitle">
          Управление внешними провайдерами поиска (2GIS, Foursquare, Google), резервными копиями и шаблонами WhatsApp.
        </p>
      </div>

      <div className="settings-grid">
        {/* Card 1: 2GIS API Key */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-icon-box blue">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="card-title">2GIS Catalog API 3.0</h2>
              <p className="card-subtitle">
                Официальный каталог организаций Казахстана (телефоны, адреса, сайты)
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="field-group">
              <label className="field-label">
                <Key size={14} />
                <span>API-ключ 2GIS:</span>
              </label>
              <input
                type="password"
                className="input-custom w-full font-mono text-sm"
                placeholder="Вставьте ключ вида: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <span className="field-hint">
                Ключ сохраняется локально в защищенном хранилище браузера (localStorage).
              </span>
            </div>

            {verificationResult && (
              <div
                className={`verification-alert ${
                  verificationResult.success ? 'success' : 'warning'
                }`}
              >
                {verificationResult.success ? (
                  <CheckCircle size={16} color="#16a34a" />
                ) : (
                  <AlertCircle size={16} color="#d97706" />
                )}
                <span>{verificationResult.message}</span>
              </div>
            )}

            <div className="btn-group-actions">
              <button
                className="btn btn-primary"
                onClick={handleSaveKey}
                disabled={isVerifying || !apiKeyInput.trim()}
              >
                <Save size={15} />
                <span>{isVerifying ? 'Проверка ключа...' : 'Сохранить и проверить'}</span>
              </button>

              {isKeySaved && (
                <button className="btn btn-secondary text-red" onClick={handleRemoveKey}>
                  <Trash2 size={15} />
                  <span>Удалить ключ</span>
                </button>
              )}
            </div>

            {/* Instruction block */}
            <div className="instruction-box">
              <div className="instruction-title">
                <Info size={14} />
                <span>Как получить официальный ключ 2GIS бесплатно:</span>
              </div>
              <ol className="instruction-steps">
                <li>
                  Зарегистрируйтесь в Личном кабинете разработчика 2GIS на сайте{' '}
                  <a
                    href="https://dev.2gis.kz/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-highlight"
                  >
                    dev.2gis.kz <ExternalLink size={11} style={{ display: 'inline' }} />
                  </a>
                </li>
                <li>Создайте новое приложение и подключите сервис <strong>Каталог API (3.0)</strong></li>
                <li>Скопируйте предоставленный API-ключ и вставьте в поле выше</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Card 2: Foursquare Places API */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-icon-box pink">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="card-title">Foursquare Places API</h2>
              <p className="card-subtitle">
                Международная база заведений (Free Tier: $200/мес бесплатного кредита до 50k запросов)
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="field-group">
              <label className="field-label">
                <Key size={14} />
                <span>API-ключ Foursquare Places (v3):</span>
              </label>
              <input
                type="password"
                className="input-custom w-full font-mono text-sm"
                placeholder="fsq3..."
                value={fsqKeyInput}
                onChange={(e) => setFsqKeyInput(e.target.value)}
              />
              <span className="field-hint">
                Тариф Personal включает $200 ежемесячно без обязательного платного списания.
              </span>
            </div>

            <div className="btn-group-actions">
              <button
                className="btn btn-primary"
                onClick={handleSaveFsqKey}
                disabled={!fsqKeyInput.trim()}
              >
                <Save size={15} />
                <span>Сохранить ключ Foursquare</span>
              </button>

              {isFsqSaved && (
                <button className="btn btn-secondary text-red" onClick={handleRemoveFsqKey}>
                  <Trash2 size={15} />
                  <span>Удалить ключ</span>
                </button>
              )}
            </div>

            <div className="instruction-box">
              <div className="instruction-title">
                <Info size={14} />
                <span>Получение ключа Foursquare:</span>
              </div>
              <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                Создайте бесплатный аккаунт на{' '}
                <a
                  href="https://location.foursquare.com/developer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-highlight"
                >
                  location.foursquare.com/developer <ExternalLink size={11} style={{ display: 'inline' }} />
                </a>{' '}
                и сгенерируйте API-ключ в разделе <strong>API Keys</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Google Places API */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-icon-box red">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="card-title">Google Places API (New)</h2>
              <p className="card-subtitle">
                Официальный поиск Google Maps (опционально, требуется Google Cloud Console)
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="field-group">
              <label className="field-label">
                <Key size={14} />
                <span>API-ключ Google Cloud Places:</span>
              </label>
              <input
                type="password"
                className="input-custom w-full font-mono text-sm"
                placeholder="AIzaSy..."
                value={googleKeyInput}
                onChange={(e) => setGoogleKeyInput(e.target.value)}
              />
              <span className="field-hint">
                Google предоставляет $200 кредита ежемесячно. Подключение полностью опционально.
              </span>
            </div>

            <div className="btn-group-actions">
              <button
                className="btn btn-primary"
                onClick={handleSaveGoogleKey}
                disabled={!googleKeyInput.trim()}
              >
                <Save size={15} />
                <span>Сохранить ключ Google</span>
              </button>

              {isGoogleSaved && (
                <button className="btn btn-secondary text-red" onClick={handleRemoveGoogleKey}>
                  <Trash2 size={15} />
                  <span>Удалить ключ</span>
                </button>
              )}
            </div>

            <div className="instruction-box">
              <div className="instruction-title">
                <Info size={14} />
                <span>Документация Google Places:</span>
              </div>
              <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                Для использования включите Places API (New) в{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-highlight"
                >
                  Google Cloud Console <ExternalLink size={11} style={{ display: 'inline' }} />
                </a>.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: WhatsApp Templates & Portfolio */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-icon-box green">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="card-title">Шаблоны предложений WhatsApp</h2>
              <p className="card-subtitle">
                Двуязычные сообщения со ссылками на портфолио Нурдаулета
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="template-preview-box">
              <div className="template-header">
                <span className="lang-tag">🇷🇺 Русский шаблон</span>
              </div>
              <div className="template-body-text">
                {getDefaultMessage('«Название бизнеса»', 'Студия красоты', 'ru')}
              </div>
            </div>

            <div className="template-preview-box mt-3">
              <div className="template-header">
                <span className="lang-tag">🇰🇿 Казахский шаблон (9 специфических букв)</span>
              </div>
              <div className="template-body-text">
                {getDefaultMessage('«Бизнес атауы»', 'Сұлулық студиясы', 'kz')}
              </div>
            </div>

            <div className="portfolio-links-box">
              <div className="portfolio-title">
                <Sparkles size={14} color="#25D366" />
                <span>Встроенные ссылки на портфолио:</span>
              </div>
              <ul className="portfolio-list">
                <li>
                  <a
                    href="https://portfolio-smoky-theta-39.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-highlight"
                  >
                    https://portfolio-smoky-theta-39.vercel.app/
                  </a>
                </li>
                <li>
                  <a
                    href="https://nail-stylist-mody.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-highlight"
                  >
                    https://nail-stylist-mody.vercel.app/
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Card 5: Storage & Database Health */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-icon-box purple">
              <Database size={20} />
            </div>
            <div>
              <h2 className="card-title">Локальная база данных (Хранилище)</h2>
              <p className="card-subtitle">
                Диагностика объема, резервные копии и сброс данных
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="storage-stats-grid">
              <div className="stat-card">
                <div className="stat-card-label">Всего контактов</div>
                <div className="stat-card-value">{leads.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Объем данных</div>
                <div className="stat-card-value">~{storageUsageKb} КБ</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Статус хранилища</div>
                <div className="stat-card-value text-emerald">Безопасно</div>
              </div>
            </div>

            <div className="storage-actions-list">
              <div className="action-item">
                <div>
                  <div className="action-title">Резервная копия (JSON-бэкап)</div>
                  <div className="action-desc">
                    Скачать полный архив всех ваших лидов со всей историей кликов и статусов
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={handleExportBackupJson}>
                  <Download size={14} />
                  <span>Скачать JSON</span>
                </button>
              </div>

              <div className="action-item border-top">
                <div>
                  <div className="action-title">Сброс базы данных</div>
                  <div className="action-desc">
                    Вернуть базу к демонстрационным 6 контактам по Казахстану
                  </div>
                </div>
                <button className="btn btn-secondary text-red" onClick={onResetDemo}>
                  <RotateCcw size={14} />
                  <span>Сброс к демо</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
