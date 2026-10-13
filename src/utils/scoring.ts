import type {
  BusinessLead,
  LeadGrade,
  LeadScoreFactor,
  LeadScoreResult,
  LeadScoreWeights,
} from '../types';

/**
 * Стандартные настраиваемые веса скоринга лидов.
 * Каждое начисление баллов прозрачно объясняется пользователю.
 */
export const DEFAULT_LEAD_SCORE_WEIGHTS: LeadScoreWeights = {
  noWebsiteListed: 40,
  validMobilePhone: 25,
  validLandlinePhone: 10,
  highMarginCategory: 20,
  midMarginCategory: 15,
  baseCategory: 10,
  hasAddress: 6,
  hasCoordinates: 4,
  verifiedSource2Gis: 5,
  verifiedSourceOsm: 3,
};

// Мобильные DEF-префиксы операторов Казахстана (Kcell, Activ, Beeline, Tele2, Altel, Izi)
const KZ_MOBILE_PREFIXES = [
  '700', '701', '702', '705', '706', '707', '708',
  '747', '771', '775', '776', '777', '778',
];

// Категории с высоким чеком и критической потребностью в индивидуальном сайте
const HIGH_MARGIN_CATEGORIES = [
  'dentistry',
  'стоматология',
  'клиника',
  'медицинский центр',
  'spa',
  'спа',
  'fitness',
  'фитнес',
  'ресторан',
  'банкетный зал',
  'restaurant',
  'юрист',
  'нотариус',
];

// Категории со средним чеком (бьюти-сфера, уход, автоуслуги, кондитерские)
const MID_MARGIN_CATEGORIES = [
  'beauty_salon',
  'салон красоты',
  'nail_studio',
  'ногтевая студия',
  'маникюр',
  'barbershop',
  'барбершоп',
  'car_wash',
  'автомойка',
  'детейлинг',
  'автосервис',
  'confectionery',
  'кондитерская',
  'косметология',
];

/**
 * Проверяет, относится ли номер к мобильным кодам Казахстана.
 * Примечание: факт мобильного номера повышает вероятность WhatsApp,
 * но не является 100% гарантией до первой отправки.
 */
export function isKazakhstanMobile(phoneFormatted: string): boolean {
  if (!phoneFormatted || phoneFormatted.length !== 11) return false;
  if (!phoneFormatted.startsWith('7')) return false;

  const prefix = phoneFormatted.substring(1, 4);
  return KZ_MOBILE_PREFIXES.includes(prefix);
}

/**
 * Прозрачно вычисляет рейтинг лида от 0 до 100 баллов.
 * Неизвестные данные не считаются отрицательными (баллы просто не начисляются).
 *
 * @param lead Данные организации
 * @param weights Опциональные кастомные веса факторов
 * @returns Результат расчета с итоговым баллом, грейдом и расшифровкой каждого фактора
 */
export function calculateLeadScore(
  lead: Partial<BusinessLead>,
  weights: LeadScoreWeights = DEFAULT_LEAD_SCORE_WEIGHTS
): LeadScoreResult {
  let totalScore = 0;
  const factors: LeadScoreFactor[] = [];
  const reasons: string[] = [];

  const addFactor = (factorKey: string, points: number, desc: string) => {
    if (points > 0) {
      totalScore += points;
      factors.push({ factor: factorKey, points, description: desc });
      reasons.push(desc);
    }
  };

  // 1. Потребность в разработке сайта (главный драйвер)
  // Внимание: статус NO_WEBSITE_LISTED означает, что сайт не найден в проверенных источниках,
  // а не доказательство его полного отсутствия в интернете.
  if (lead.websiteStatus === 'NO_WEBSITE_LISTED') {
    addFactor(
      'no_website',
      weights.noWebsiteListed,
      `Сайт не найден в проверенных источниках (+${weights.noWebsiteListed})`
    );
  } else if (lead.websiteStatus === 'WEBSITE_LISTED') {
    // Если сайт уже есть, очки за отсутствие сайта не начисляются
    reasons.push('Сайт уже указан в справочнике (0)');
  }

  // 2. Достижимость через WhatsApp (телефонный фактор)
  if (lead.isValidPhone && lead.phoneFormatted) {
    if (isKazakhstanMobile(lead.phoneFormatted)) {
      addFactor(
        'mobile_phone_kz',
        weights.validMobilePhone,
        `Мобильный номер РК (высокая вероятность WhatsApp) (+${weights.validMobilePhone})`
      );
    } else {
      addFactor(
        'valid_landline',
        weights.validLandlinePhone,
        `Контактный телефон подтверждён (+${weights.validLandlinePhone})`
      );
    }
  }

  // 3. Маржинальность ниши и готовность платить за сайт
  const cat = (lead.category || '').toLowerCase();
  const isHighMargin = HIGH_MARGIN_CATEGORIES.some((c) => cat.includes(c));
  const isMidMargin = MID_MARGIN_CATEGORIES.some((c) => cat.includes(c));

  if (isHighMargin) {
    addFactor(
      'category_high_margin',
      weights.highMarginCategory,
      `Высокочековая сфера бизнеса (+${weights.highMarginCategory})`
    );
  } else if (isMidMargin) {
    addFactor(
      'category_mid_margin',
      weights.midMarginCategory,
      `Сфера услуг с регулярным спросом (+${weights.midMarginCategory})`
    );
  } else if (cat.trim().length > 0) {
    addFactor(
      'category_base',
      weights.baseCategory,
      `Базовая категория бизнеса (+${weights.baseCategory})`
    );
  }

  // 4. Полнота контактных и геолокационных данных
  if (lead.address && lead.address.trim().length > 3) {
    addFactor(
      'has_address',
      weights.hasAddress,
      `Указан точный фактический адрес (+${weights.hasAddress})`
    );
  }

  if (lead.coordinates && lead.coordinates.lat && lead.coordinates.lon) {
    addFactor(
      'has_coordinates',
      weights.hasCoordinates,
      `Подтверждены GPS-координаты объекта (+${weights.hasCoordinates})`
    );
  }

  // 5. Источник данных
  if (lead.source === 'MULTI') {
    addFactor(
      'source_multi',
      6,
      'Объединённые данные из нескольких источников (+6)'
    );
  } else if (lead.source === '2GIS') {
    addFactor(
      'source_2gis',
      weights.verifiedSource2Gis,
      `Проверенный каталог 2GIS (+${weights.verifiedSource2Gis})`
    );
  } else if (lead.source === 'GOOGLE') {
    addFactor(
      'source_google',
      5,
      'Верифицированные данные Google Places (+5)'
    );
  } else if (lead.source === 'FOURSQUARE') {
    addFactor(
      'source_foursquare',
      4,
      'Каталог заведений Foursquare Places (+4)'
    );
  } else if (lead.source === 'OSM') {
    addFactor(
      'source_osm',
      weights.verifiedSourceOsm,
      `Геоданные OpenStreetMap (+${weights.verifiedSourceOsm})`
    );
  }

  // Ограничиваем сверху 100 баллами
  const clampedScore = Math.min(Math.max(totalScore, 0), 100);

  // Определение грейда лида
  let grade: LeadGrade;
  if (clampedScore >= 85) {
    grade = 'A';
  } else if (clampedScore >= 65) {
    grade = 'B';
  } else if (clampedScore >= 40) {
    grade = 'C';
  } else {
    grade = 'D';
  }

  return {
    score: clampedScore,
    grade,
    reasons,
    factors,
  };
}

/**
 * Возвращает визуальное текстовое описание грейда для UI
 */
export function getGradeLabel(grade: LeadGrade): {
  label: string;
  badgeClass: string;
  emoji: string;
} {
  switch (grade) {
    case 'A':
      return { label: 'Горячий лид', badgeClass: 'grade-a', emoji: '🔥' };
    case 'B':
      return { label: 'Тёплый лид', badgeClass: 'grade-b', emoji: '⚡' };
    case 'C':
      return { label: 'Умеренный потенциал', badgeClass: 'grade-c', emoji: '📋' };
    case 'D':
    default:
      return { label: 'Низкий приоритет', badgeClass: 'grade-d', emoji: '❄️' };
  }
}
