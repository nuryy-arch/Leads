import type { HistoryEvent, Language, LeadStatus } from '../types';

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Normalizes phone numbers according to international standard (digits only, no +, no spaces, no brackets).
 * Handles KZ/RU local prefix 8 (converts 8XXXXXXXXXX -> 7XXXXXXXXXX).
 * Validates international format (10-15 digits).
 */
export function normalizePhoneNumber(raw: string): PhoneValidationResult {
  if (!raw || typeof raw !== 'string') {
    return {
      isValid: false,
      normalized: '',
      error: 'Номер телефона не указан',
    };
  }

  // Remove any spaces, dashes, brackets, dots, plus signs
  let cleaned = raw.replace(/[\s\-().+]/g, '');

  // Reject if any non-digit character remains
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'Номер содержит недопустимые символы (разрешены только цифры и +)',
    };
  }

  // If number starts with 8 and is 11 digits (typical KZ/RU domestic dialing),
  // convert starting 8 to international country code 7
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }

  // Validate length: E.164 standard allows between 10 and 15 digits
  if (cleaned.length < 10) {
    return {
      isValid: false,
      normalized: cleaned,
      error: `Номер слишком короткий (${cleaned.length} цифр, минимум 10)`,
    };
  }

  if (cleaned.length > 15) {
    return {
      isValid: false,
      normalized: cleaned,
      error: `Номер слишком длинный (${cleaned.length} цифр, максимум 15)`,
    };
  }

  // Specific check for KZ / RU numbers (starting with 7)
  if (cleaned.startsWith('7') && cleaned.length !== 11) {
    return {
      isValid: false,
      normalized: cleaned,
      error: `Казахстанский/российский номер (+7) должен содержать 11 цифр (получено ${cleaned.length})`,
    };
  }

  return {
    isValid: true,
    normalized: cleaned,
  };
}

/**
 * Format phone for pleasant human-readable display in the UI
 */
export function formatPhoneForDisplay(normalized: string): string {
  if (!normalized) return '—';
  if (normalized.startsWith('7') && normalized.length === 11) {
    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }
  return `+${normalized}`;
}

/**
 * Generates default personalized proposal message for a business lead
 */
export function getDefaultMessage(businessName: string, category: string, lang: Language): string {
  const trimmedName = businessName.trim();
  const trimmedCategory = category.trim();

  if (lang === 'kz') {
    const businessTarget = trimmedName ? `«${trimmedName}»` : 'сіздің бизнесіңіз';
    const targetWithCategory = trimmedCategory
      ? `${trimmedCategory} «${trimmedName}»`
      : businessTarget;

    return (
`Сәлеметсіз бе! 👋 Менің атым Нұрдәулет, мен бизнеске арналған заманауи сайттар жасаумен айналысамын.
${targetWithCategory} үшін әдемі дизайны, қызметтер тізімі, бағасы және WhatsApp арқылы ыңғайлы жазылуы бар сайт жасауды ұсынамын.

Менің жұмыстарымның мысалдары:
https://portfolio-smoky-theta-39.vercel.app/
Бьюти-салаға арналған сайт:
https://nail-stylist-mody.vercel.app/

Егер сізге қызық болса, толығырақ талқылап, сіздің бизнесіңізге арналған шешім ұсынуға өте қуаныштымын.`
    );
  }

  // Default Russian message template as requested
  const businessTarget = trimmedCategory && trimmedName
    ? `вашей студии «${trimmedName}»`
    : (trimmedName ? `вашей студии «${trimmedName}»` : 'вашей студии');

  return (
`Здравствуйте! 👋 Меня зовут Нурдаулет, я занимаюсь разработкой современных сайтов для бизнеса.
Предлагаю создать для ${businessTarget} сайт с красивым дизайном, перечнем услуг, прайсом и удобной записью через WhatsApp.

Примеры моих работ:
https://portfolio-smoky-theta-39.vercel.app/
Сайт для бьюти-сферы:
https://nail-stylist-mody.vercel.app/

Если вам интересно, буду рад обсудить детали и предложить решение под ваш бизнес.`
  );
}

/**
 * Generates official WhatsApp Click-to-Chat URL
 * Format: https://api.whatsapp.com/send/?phone=77001234567&text=ENCODED_MESSAGE
 * Encodes text properly via encodeURIComponent without double-encoding.
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const { normalized, isValid } = normalizePhoneNumber(phone);
  if (!isValid) {
    throw new Error('Невозможно сгенерировать ссылку: некорректный формат номера телефона');
  }

  // Using encodeURIComponent safely encodes Cyrillic, Kazakh symbols, emojis, and newlines
  const encodedText = encodeURIComponent(message);
  return `https://api.whatsapp.com/send/?phone=${normalized}&text=${encodedText}`;
}

/**
 * Safely navigates to the WhatsApp Click-to-Chat URL in a new browser tab
 * Prevents tab hijacking with noopener, noreferrer
 */
export function openWhatsAppSafely(url: string): Window | null {
  if (typeof window === 'undefined') return null;
  return window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Helper to create a new timestamped history event
 */
export function createHistoryEvent(
  type: HistoryEvent['type'],
  description: string,
  previousStatus?: LeadStatus,
  newStatus?: LeadStatus
): HistoryEvent {
  return {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    description,
    previousStatus,
    newStatus,
  };
}
