import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  generateWhatsAppLink,
  getDefaultMessage,
  formatPhoneForDisplay,
  createHistoryEvent,
} from './whatsapp';

describe('normalizePhoneNumber', () => {
  it('converts +7 777 456-80-00 to 77774568000 (standard requirement)', () => {
    const result = normalizePhoneNumber('+7 777 456-80-00');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('77774568000');
  });

  it('converts local KZ prefix 8 701 123 45 67 to international 77011234567', () => {
    const result = normalizePhoneNumber('8 (701) 123-45-67');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('77011234567');
  });

  it('accepts already normalized 77001234567', () => {
    const result = normalizePhoneNumber('77001234567');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('77001234567');
  });

  it('rejects invalid numbers with letters or symbols', () => {
    const result = normalizePhoneNumber('+7 777 ABC-80-00');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('недопустимые символы');
  });

  it('rejects numbers that are too short', () => {
    const result = normalizePhoneNumber('+7 777 45');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('короткий');
  });

  it('rejects empty or whitespace input', () => {
    const result = normalizePhoneNumber('   ');
    expect(result.isValid).toBe(false);
  });
});

describe('formatPhoneForDisplay', () => {
  it('formats 77774568000 into human readable +7 (777) 456-80-00', () => {
    expect(formatPhoneForDisplay('77774568000')).toBe('+7 (777) 456-80-00');
  });
});

describe('getDefaultMessage', () => {
  it('contains business name, author name, and portfolio links in Russian', () => {
    const message = getDefaultMessage('Элегант', 'Студия красоты', 'ru');
    expect(message).toContain('Нурдаулет');
    expect(message).toContain('👋');
    expect(message).toContain('Элегант');
    expect(message).toContain('https://portfolio-smoky-theta-39.vercel.app/');
    expect(message).toContain('https://nail-stylist-mody.vercel.app/');
    expect(message).toContain('Если вам интересно, буду рад обсудить детали');
  });

  it('contains Kazakh characters, portfolio links, and proper greeting in Kazakh', () => {
    const message = getDefaultMessage('Сұлулық әлемі', 'Сұлулық салоны', 'kz');
    expect(message).toContain('Сәлеметсіз бе! 👋');
    expect(message).toContain('Нұрдәулет');
    expect(message).toContain('Сұлулық әлемі');
    expect(message).toContain('https://portfolio-smoky-theta-39.vercel.app/');
    expect(message).toContain('https://nail-stylist-mody.vercel.app/');
    // Verify specific Kazakh Cyrillic letters
    expect(message).toMatch(/[әіңғүұқөһ]/i);
  });
});

describe('generateWhatsAppLink', () => {
  it('generates a valid WhatsApp Click-to-Chat URL format', () => {
    const phone = '+7 777 456-80-00';
    const message = 'Здравствуйте! 👋 Тест';
    const link = generateWhatsAppLink(phone, message);

    expect(link.startsWith('https://api.whatsapp.com/send/?phone=77774568000&text=')).toBe(true);

    const url = new URL(link);
    expect(url.origin).toBe('https://api.whatsapp.com');
    expect(url.pathname).toBe('/send/');
    expect(url.searchParams.get('phone')).toBe('77774568000');
    expect(url.searchParams.get('text')).toBe(message);
  });

  it('properly encodes and decodes Russian Cyrillic and emojis without double encoding', () => {
    const phone = '77001234567';
    const message = 'Здравствуйте! 👋 Меня зовут Нурдаулет.\nНовая строка!';
    const link = generateWhatsAppLink(phone, message);

    // No double-encoded %25
    expect(link).not.toContain('%25');
    // Newline is encoded as %0A
    expect(link).toContain('%0A');

    const url = new URL(link);
    expect(url.searchParams.get('text')).toBe(message);
  });

  it('properly encodes and decodes Kazakh characters (ә, і, ң, ғ, ү, ұ, қ, ө, һ, Ә, І, Ң, Ғ, Ү, Ұ, Қ, Ө, Һ)', () => {
    const kazakhText = 'Сәлеметсіз бе! Бұл қазақша мәтін: әіңғүұқөһ ӘІҢҒҮҰҚӨҺ';
    const phone = '77001234567';
    const link = generateWhatsAppLink(phone, kazakhText);

    const url = new URL(link);
    const decoded = url.searchParams.get('text');
    expect(decoded).toBe(kazakhText);
  });

  it('throws an error when phone number is invalid', () => {
    expect(() => generateWhatsAppLink('invalid-phone', 'Hi')).toThrow();
  });
});

describe('createHistoryEvent', () => {
  it('creates an event with a timestamp and unique id', () => {
    const event = createHistoryEvent('LINK_OPENED', 'Ссылка открыта', 'NEW', 'LINK_OPENED');
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.type).toBe('LINK_OPENED');
    expect(event.previousStatus).toBe('NEW');
    expect(event.newStatus).toBe('LINK_OPENED');
  });
});
