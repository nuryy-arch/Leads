import React, { useState } from 'react';
import {
  CloudUpload,
  Database,
  Download,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Building2,
  Clock,
} from 'lucide-react';
import type { BusinessLead } from '../types';
import { leadRepository } from '../services/leadRepository';
import { exportLeadsToCsv } from '../utils/leadManagement';

interface MigrationModalProps {
  localLeads: BusinessLead[];
  userId: string;
  onClose: () => void;
  onMigrationComplete: (cloudLeads: BusinessLead[]) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  localLeads,
  userId,
  onClose,
  onMigrationComplete,
  onShowToast,
}) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    inserted: number;
    failed: number;
  } | null>(null);

  const handleDownloadBackup = () => {
    exportLeadsToCsv(
      localLeads,
      `lead_hunter_pre_migration_backup_${new Date().toISOString().slice(0, 10)}.csv`
    );
    onShowToast('Резервная копия скачана в CSV!', 'success');
  };

  const handleStartMigration = async () => {
    setIsMigrating(true);
    setProgressCount(0);
    setMigrationResult(null);

    try {
      // 1. Fetch existing leads in cloud to prevent duplicates
      const existingInCloud = await leadRepository.fetchUserLeads(userId);
      const existingClientIds = new Set(existingInCloud.map((l) => l.id));

      // 2. Filter out already uploaded leads
      const toUpload = localLeads.filter((l) => !existingClientIds.has(l.id));

      if (toUpload.length === 0) {
        setIsMigrating(false);
        setMigrationResult({ success: true, inserted: 0, failed: 0 });
        onShowToast('Все локальные контакты уже синхронизированы с облаком!', 'info');
        onMigrationComplete(existingInCloud);
        return;
      }

      // 3. Batch insert
      const res = await leadRepository.batchInsertLeads(toUpload, userId, 25);
      setIsMigrating(false);

      if (res.failed > 0 && res.inserted === 0) {
        setMigrationResult({ success: false, inserted: 0, failed: res.failed });
        onShowToast('Ошибка миграции. Исходные локальные данные сохранены.', 'error');
      } else {
        setMigrationResult({ success: true, inserted: res.inserted, failed: res.failed });
        onShowToast(
          `Успешно мигрировано ${res.inserted} лидов в защищённое облако Supabase!`,
          'success'
        );

        // Fetch refreshed cloud leads
        const updatedCloudLeads = await leadRepository.fetchUserLeads(userId);
        onMigrationComplete(updatedCloudLeads);
      }
    } catch (err: any) {
      setIsMigrating(false);
      setMigrationResult({ success: false, inserted: 0, failed: localLeads.length });
      onShowToast(`Сбой миграции: ${err.message || 'Сетевая ошибка'}. Данные в localStorage сохранены.`, 'error');
    }
  };

  const dncCount = localLeads.filter((l) => l.status === 'DO_NOT_CONTACT').length;
  const linkOpenedCount = localLeads.filter((l) => l.status === 'LINK_OPENED').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#e0f2fe', padding: 8, borderRadius: 10, color: '#0284c7' }}>
              <CloudUpload size={22} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 18 }}>Миграция данных в Supabase</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Безопасный перенос контактов из локального браузера в облачную БД PostgreSQL
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isMigrating}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {/* Summary Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
              Обнаружены существующие контакты в вашем браузере:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                <Database size={14} color="#0284c7" />
                <span>Всего локальных лидов: <strong>{localLeads.length}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                <Clock size={14} color="#059669" />
                <span>Открыто ссылок WhatsApp: <strong>{linkOpenedCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                <ShieldCheck size={14} color="#dc2626" />
                <span>Статус DO_NOT_CONTACT: <strong>{dncCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                <Building2 size={14} color="#8b5cf6" />
                <span>Филиалы и скоринг: <strong>сохраняются</strong></span>
              </div>
            </div>
          </div>

          {/* Guarantees Box */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 12,
              color: '#166534',
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            <strong>Гарантии безопасности:</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li>Локальные данные в localStorage <strong>НЕ удаляются</strong>.</li>
              <li>Статус <code>DO_NOT_CONTACT</code> и история WhatsApp сохраняются без изменений.</li>
              <li>Статус <code>LINK_OPENED</code> остаётся неизменным (не превращается в фиктивный SENT).</li>
              <li>Повторный запуск миграции безопасен и защищён от дубликатов.</li>
            </ul>
          </div>

          {/* Result Banner */}
          {migrationResult && (
            <div
              style={{
                background: migrationResult.success ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${migrationResult.success ? '#a7f3d0' : '#fecaca'}`,
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {migrationResult.success ? (
                <CheckCircle size={20} color="#16a34a" />
              ) : (
                <AlertCircle size={20} color="#dc2626" />
              )}
              <div style={{ fontSize: 13, color: migrationResult.success ? '#065f46' : '#991b1b' }}>
                {migrationResult.success ? (
                  <span>Миграция завершена! Перенесено контактов: <strong>{migrationResult.inserted}</strong>.</span>
                ) : (
                  <span>Не удалось загрузить данные. Проверьте соединение с Supabase.</span>
                )}
              </div>
            </div>
          )}

          {/* Backup Button Recommendation */}
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={handleDownloadBackup}
              disabled={isMigrating}
              style={{ fontSize: 12 }}
            >
              <Download size={14} />
              <span>Скачать резервную копию CSV перед миграцией</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isMigrating}
          >
            Отложить
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartMigration}
            disabled={isMigrating}
            style={{ background: '#0284c7' }}
          >
            {isMigrating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Импорт в облако ({progressCount}/{localLeads.length})...</span>
              </>
            ) : (
              <>
                <CloudUpload size={14} />
                <span>Импортировать в облако ({localLeads.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
