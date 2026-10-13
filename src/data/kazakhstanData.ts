import type { BusinessCategoryOption, KazakhstanCity } from '../types';

export const KAZAKHSTAN_CITIES: KazakhstanCity[] = [
  { id: 'almaty', name: 'Алматы', nameKz: 'Алматы', regionId: 68 },
  { id: 'astana', name: 'Астана', nameKz: 'Астана', regionId: 118 },
  { id: 'shymkent', name: 'Шымкент', nameKz: 'Шымкент', regionId: 162 },
  { id: 'karaganda', name: 'Караганда', nameKz: 'Қарағанды', regionId: 116 },
  { id: 'aktobe', name: 'Актобе', nameKz: 'Ақтөбе', regionId: 163 },
  { id: 'pavlodar', name: 'Павлодар', nameKz: 'Павлодар', regionId: 117 },
  { id: 'oskemen', name: 'Усть-Каменогорск', nameKz: 'Өскемен', regionId: 115 },
  { id: 'semey', name: 'Семей', nameKz: 'Семей', regionId: 164 },
  { id: 'atyrau', name: 'Атырау', nameKz: 'Атырау', regionId: 161 },
  { id: 'kostanay', name: 'Костанай', nameKz: 'Қостанай', regionId: 160 },
  { id: 'taraz', name: 'Тараз', nameKz: 'Тараз', regionId: 165 },
  { id: 'oral', name: 'Уральск', nameKz: 'Орал', regionId: 159 },
  { id: 'aktau', name: 'Актау', nameKz: 'Ақтау', regionId: 158 },
  { id: 'petropavlovsk', name: 'Петропавловск', nameKz: 'Петропавл', regionId: 166 },
  { id: 'turkestan', name: 'Туркестан', nameKz: 'Түркістан', regionId: 186 },
  { id: 'kyzylorda', name: 'Кызылорда', nameKz: 'Қызылорда', regionId: 185 },
  { id: 'kokshetau', name: 'Кокшетау', nameKz: 'Көкшетау', regionId: 167 },
  { id: 'temirtau', name: 'Темиртау', nameKz: 'Теміртау', regionId: 116 },
];

export const BUSINESS_CATEGORIES: BusinessCategoryOption[] = [
  { id: 'barbershop', name: 'Барбершопы', query: 'барбершоп' },
  { id: 'beauty_salon', name: 'Салоны красоты', query: 'салон красоты' },
  { id: 'nail_studio', name: 'Ногтевые студии', query: 'ногтевая студия' },
  { id: 'coffee_shop', name: 'Кофейни', query: 'кофейня' },
  { id: 'confectionery', name: 'Кондитерские', query: 'кондитерская' },
  { id: 'car_wash', name: 'Автомойки', query: 'автомойка' },
  { id: 'clothing_store', name: 'Магазины одежды', query: 'магазин одежды' },
  { id: 'flower_shop', name: 'Цветочные магазины', query: 'цветы' },
  { id: 'dentistry', name: 'Стоматологии', query: 'стоматология' },
  { id: 'fitness', name: 'Фитнес-клубы', query: 'фитнес клуб' },
  { id: 'spa', name: 'Спа-салоны', query: 'спа' },
  { id: 'restaurant', name: 'Рестораны и кафе', query: 'ресторан' },
];
