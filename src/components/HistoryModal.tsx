import React from 'react';
import { X, Clock, ExternalLink, Copy, CheckCircle, Edit3 } from 'lucide-react';
import type { BusinessLead, HistoryEvent } from '../types';

interface HistoryModalProps {
  lead: BusinessLead | null;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ lead, onClose }) => {
  if (!lead) return null;

  const formatDate = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getEventIcon = (type: HistoryEvent['type']) => {
    switch (type) {
      case 'LINK_OPENED':
        return <ExternalLink size={14} color="#8b5cf6" />;
      case 'MESSAGE_COPIED':
        return <Copy size={14} color="#3b82f6" />;
      case 'MARKED_SENT':
        return <CheckCircle size={14} color="#10b981" />;
      case 'STATUS_CHANGED':
        return <Clock size={14} color="#f59e0b" />;
      case 'MESSAGE_EDITED':
        return <Edit3 size={14} color="#6366f1" />;
      default:
        return <Clock size={14} />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">История действий и статусов</h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
              {lead.businessName} • {lead.phoneFormatted}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '4px 0' }}>
          {lead.history.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
              История пока пуста
            </p>
          ) : (
            <div className="timeline">
              {lead.history.map((event) => (
                <div key={event.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-time">{formatDate(event.timestamp)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                    {getEventIcon(event.type)}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      {event.type}
                    </span>
                    {event.newStatus && (
                      <span className={`status-badge ${event.newStatus}`} style={{ transform: 'scale(0.85)', transformOrigin: 'left center' }}>
                        {event.newStatus}
                      </span>
                    )}
                  </div>
                  <div className="timeline-desc">{event.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
