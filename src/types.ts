export type LeadStatus =
  | 'NEW'
  | 'LINK_OPENED'
  | 'SENT'
  | 'INTERESTED'
  | 'REJECTED'
  | 'DO_NOT_CONTACT';

export type Language = 'ru' | 'kz';

export interface HistoryEvent {
  id: string;
  timestamp: string;
  type: 'LINK_OPENED' | 'MESSAGE_COPIED' | 'MARKED_SENT' | 'STATUS_CHANGED' | 'MESSAGE_EDITED';
  description: string;
  previousStatus?: LeadStatus;
  newStatus?: LeadStatus;
}

export interface BusinessLead {
  id: string;
  businessName: string;
  category: string;
  phoneRaw: string;
  phoneFormatted: string;
  isValidPhone: boolean;
  phoneError?: string;
  city: string;
  language: Language;
  customMessage?: string;
  status: LeadStatus;
  history: HistoryEvent[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
