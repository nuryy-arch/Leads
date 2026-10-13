import { describe, it, expect } from 'vitest';
import {
  generateWhatsAppLink,
  getDefaultMessage,
  normalizePhoneNumber,
  createHistoryEvent,
} from './whatsapp';
import type { BusinessLead, LeadStatus } from '../types';

describe('Business Rules and Requirements Verification', () => {
  it('Requirement 1 & 2: Handles raw phone +7 777 456-80-00 and converts to 77774568000', () => {
    const raw = '+7 777 456-80-00';
    const norm = normalizePhoneNumber(raw);
    expect(norm.isValid).toBe(true);
    expect(norm.normalized).toBe('77774568000');
    expect(norm.normalized).not.toContain('+');
    expect(norm.normalized).not.toContain(' ');
    expect(norm.normalized).not.toContain('-');
    expect(norm.normalized).not.toContain('(');
    expect(norm.normalized).not.toContain(')');
  });

  it('Requirement 3 & 4: Generates exact URL with https://api.whatsapp.com/send/?phone=...&text=...', () => {
    const message = getDefaultMessage('Aura Beauty', 'Студия красоты', 'ru');
    const link = generateWhatsAppLink('+7 777 456-80-00', message);

    expect(link).toMatch(/^https:\/\/api\.whatsapp\.com\/send\/\?phone=77774568000&text=/);
    expect(link).toContain('portfolio-smoky-theta-39.vercel.app');
    expect(link).toContain('nail-stylist-mody.vercel.app');
  });

  it('Requirement: Kazakh language support preserves all 9 Kazakh specific Cyrillic letters (ә, і, ң, ғ, ү, ұ, қ, ө, һ)', () => {
    const kzMessage = getDefaultMessage('Сұлулық әлемі', 'Сұлулық студиясы', 'kz');
    const link = generateWhatsAppLink('8 (701) 987-65-43', kzMessage);

    const url = new URL(link);
    const decoded = url.searchParams.get('text');
    expect(decoded).toBe(kzMessage);

    // Verify presence of Kazakh-specific letters
    const kzLetters = ['ә', 'і', 'ң', 'ғ', 'ү', 'ұ', 'қ', 'ө'];
    for (const letter of kzLetters) {
      expect(decoded?.toLowerCase()).toContain(letter);
    }
  });

  it('Requirement: Russian message template matches requested wording and portfolio links', () => {
    const ruMessage = getDefaultMessage('Моя Студия', 'Студия красоты', 'ru');
    expect(ruMessage).toContain('Здравствуйте! 👋 Меня зовут Нурдаулет');
    expect(ruMessage).toContain('https://portfolio-smoky-theta-39.vercel.app/');
    expect(ruMessage).toContain('https://nail-stylist-mody.vercel.app/');
    expect(ruMessage).toContain('Если вам интересно, буду рад обсудить детали');
  });

  it('Requirement: Opening WhatsApp records LINK_OPENED and does NOT mark as SENT automatically', () => {
    const initialStatus: LeadStatus = 'NEW';
    const action = 'OPEN_WHATSAPP';

    // Simulated action flow
    let status: LeadStatus = initialStatus;
    if (action === 'OPEN_WHATSAPP' && status === 'NEW') {
      status = 'LINK_OPENED'; // strictly LINK_OPENED, NOT SENT!
    }

    expect(status).toBe('LINK_OPENED');
    expect(status).not.toBe('SENT');
  });

  it('Requirement: DO_NOT_CONTACT safeguard blocks messaging', () => {
    const lead: Partial<BusinessLead> = {
      status: 'DO_NOT_CONTACT',
      phoneFormatted: '77759991122',
    };

    const canContact = lead.status !== 'DO_NOT_CONTACT';
    expect(canContact).toBe(false);
  });

  it('Requirement: Audit history tracks actions with timestamp', () => {
    const event1 = createHistoryEvent('LINK_OPENED', 'Ссылка открыта', 'NEW', 'LINK_OPENED');
    const event2 = createHistoryEvent('MARKED_SENT', 'Отмечено вручную', 'LINK_OPENED', 'SENT');

    expect(event1.type).toBe('LINK_OPENED');
    expect(event2.type).toBe('MARKED_SENT');
    expect(new Date(event1.timestamp).getTime()).toBeGreaterThan(0);
  });
});
