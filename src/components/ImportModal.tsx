import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';
import type { BusinessLead } from '../types';
import {
  parseCsvFile,
  parseExcelFile,
  type FileImportSummary,
  type ParsedImportRow,
} from '../utils/fileImport';
import { createHistoryEvent } from '../utils/whatsapp';
import { calculateLeadScore } from '../utils/scoring';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLeads: BusinessLead[];
  onImportLeads: (newLeads: BusinessLead[]) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  existingLeads,
  onImportLeads,
  onShowToast,
}) => {
  const [fileSummary, setFileSummary] = useState<FileImportSummary | null>(null);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const fileNameLower = file.name.toLowerCase();
      let summary: FileImportSummary;

      if (fileNameLower.endsWith('.xlsx')) {
        summary = await parseExcelFile(file, existingLeads);
      } else if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt')) {
        summary = await parseCsvFile(file, existingLeads);
      } else {
        throw new Error('Поддерживаются только файлы формата .csv и .xlsx (Excel)');
      }

      setFileSummary(summary);
      setRows(summary.rows);
      onShowToast(`Файл «${file.name}» успешно обработан (${summary.totalRows} строк)`, 'success');
    } catch (err: any) {
      console.error('Import processing error:', err);
      setErrorMessage(err.message || 'Ошибка чтения файла');
      onShowToast(err.message || 'Ошибка чтения файла', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const toggleRowInclusion = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, included: !r.included } : r))
    );
  };

  const handleSelectAllNonDuplicates = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        included: r.status !== 'DUPLICATE' && r.status !== 'ERROR',
      }))
    );
  };

  const handleSelectAll = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        included: r.status !== 'ERROR',
      }))
    );
  };

  const handleDeselectAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, included: false })));
  };

  const selectedCount = rows.filter((r) => r.included).length;

  const handleConfirmImport = () => {
    const toImport = rows.filter((r) => r.included && r.status !== 'ERROR');
    if (toImport.length === 0) {
      onShowToast('Не выбрано ни одной строки для импорта', 'error');
      return;
    }

    const now = new Date().toISOString();
    const newLeads: BusinessLead[] = toImport.map((row) => {
      const leadCandidate: Partial<BusinessLead> = {
        businessName: row.businessName,
        category: row.category,
        city: row.city,
        address: row.address,
        phoneFormatted: row.phoneFormatted,
        isValidPhone: row.isValidPhone,
        websiteStatus: row.websiteStatus,
        source: 'CSV',
      };
      const scoreResult = calculateLeadScore(leadCandidate);

      return {
        id: `lead-csv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        businessName: row.businessName,
        category: row.category,
        phoneRaw: row.phoneRaw,
        phoneFormatted: row.phoneFormatted,
        isValidPhone: row.isValidPhone,
        phoneError: row.phoneError,
        city: row.city,
        address: row.address,
        websiteStatus: row.websiteStatus,
        websiteUrl: row.websiteUrl,
        source: 'CSV',
        language: 'ru',
        status: 'NEW',
        notes: row.notes,
        score: scoreResult,
        history: [
          createHistoryEvent(
            'IMPORTED_FROM_CSV',
            `Импортировано из файла ${fileSummary?.fileName || 'таблицы'} (строка ${row.rowNumber}). ${
              row.status === 'BRANCH' ? 'Определено как филиал сети.' : ''
            }`,
            undefined,
            'NEW'
          ),
        ],
        createdAt: now,
        updatedAt: now,
      };
    });

    onImportLeads(newLeads);
    onShowToast(`Успешно импортировано ${newLeads.length} контактов в CRM!`, 'success');
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFileSummary(null);
    setRows([]);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '960px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet className="text-emerald-600" size={24} style={{ color: '#059669' }} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Импорт базы лидов (CSV / Excel)
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Предварительный просмотр, валидация номеров РК, дедупликация и учёт филиалов
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {!fileSummary ? (
            /* Upload Dropzone */
            <div>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragActive ? '#10b981' : '#cbd5e1'}`,
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: dragActive ? '#f0fdf4' : '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />
                <UploadCloud
                  size={48}
                  style={{ color: dragActive ? '#10b981' : '#94a3b8', margin: '0 auto 16px' }}
                />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                  Перетащите файл сюда или нажмите для выбора
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Поддерживаются форматы: <strong>.CSV</strong> (разделители <code>;</code> или <code>,</code>) и{' '}
                  <strong>.XLSX</strong> (Excel)
                </p>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: 16,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    color: '#475569',
                  }}
                >
                  Колонки: Название, Телефон, Сфера, Город, Адрес, Сайт, Заметки
                </div>
              </div>

              {isLoading && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  Чтение и анализ строк файла...
                </div>
              )}

              {errorMessage && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '13px',
                  }}
                >
                  {errorMessage}
                </div>
              )}
            </div>
          ) : (
            /* Summary & Table Preview */
            <div>
              {/* Stats Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Всего строк</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{fileSummary.totalRows}</div>
                </div>
                <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '11px', color: '#166534' }}>Новых лидов</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#166534' }}>{fileSummary.validCount}</div>
                </div>
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '11px', color: '#991b1b' }}>Дубликаты</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b' }}>{fileSummary.duplicateCount}</div>
                </div>
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', color: '#92400e' }}>Филиалы сети</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#92400e' }}>{fileSummary.branchCount}</div>
                </div>
                {fileSummary.errorCount > 0 && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '11px', color: '#b91c1c' }}>Ошибки / пропуски</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>{fileSummary.errorCount}</div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={handleSelectAllNonDuplicates}
                    title="Выбрать только уникальные и филиалы"
                  >
                    Только без дубликатов
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={handleSelectAll}
                  >
                    Выбрать все
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={handleDeselectAll}
                  >
                    Снять выбор
                  </button>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Выбрано для импорта: <span style={{ color: '#059669' }}>{selectedCount}</span> из{' '}
                  {fileSummary.totalRows}
                </div>
              </div>

              {/* Preview Table */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '36px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>Вкл</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Статус проверки</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Организация</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Телефон</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Город / Адрес</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Сайт</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Потенциал</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const isDup = row.status === 'DUPLICATE';
                      const isBranch = row.status === 'BRANCH';
                      const isErr = row.status === 'ERROR';

                      let rowBg = '#ffffff';
                      if (isDup) rowBg = '#fff5f5';
                      if (isBranch) rowBg = '#fffdf5';
                      if (isErr) rowBg = '#fdf2f2';

                      return (
                        <tr
                          key={idx}
                          style={{
                            background: rowBg,
                            borderBottom: '1px solid #f1f5f9',
                            opacity: row.included ? 1 : 0.6,
                          }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8' }}>
                            {row.rowNumber}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={row.included}
                              disabled={isErr}
                              onChange={() => toggleRowInclusion(idx)}
                              style={{ cursor: isErr ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {isDup && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                                title={row.statusMessage}
                              >
                                Дубликат
                              </span>
                            )}
                            {isBranch && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                                title={row.statusMessage}
                              >
                                🏢 Филиал сети
                              </span>
                            )}
                            {!isDup && !isBranch && !isErr && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: '#dcfce7',
                                  color: '#166534',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                Новый лид
                              </span>
                            )}
                            {isErr && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                Ошибка
                              </span>
                            )}
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: 2 }}>
                              {row.statusMessage}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                            {row.businessName}
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 400 }}>
                              {row.category}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {row.isValidPhone ? (
                              <span style={{ color: '#0f766e', fontWeight: 500 }}>
                                +{row.phoneFormatted}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>
                                {row.phoneRaw || '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#475569' }}>
                            <div>{row.city}</div>
                            {row.address && (
                              <div style={{ fontSize: '10px', color: '#64748b' }}>{row.address}</div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {row.websiteStatus === 'WEBSITE_LISTED' ? (
                              <span style={{ color: '#166534', fontSize: '11px' }}>
                                🌐 {row.websiteUrl || 'Есть сайт'}
                              </span>
                            ) : (
                              <span style={{ color: '#2563eb', fontSize: '11px' }}>
                                Не найден
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                            {row.score !== undefined ? `${row.score}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
          <div>
            {fileSummary && (
              <button className="btn btn-secondary" onClick={handleReset}>
                Выбрать другой файл
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            {fileSummary && (
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                style={{ background: '#059669', borderColor: '#059669', color: '#ffffff' }}
              >
                Импортировать {selectedCount} {selectedCount === 1 ? 'контакт' : 'контактов'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
